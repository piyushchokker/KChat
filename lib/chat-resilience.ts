import Redis from "ioredis";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}

export interface CircuitBreaker {
  isOpen(key: string): Promise<boolean>;
  recordSuccess(key: string): Promise<void>;
  recordFailure(key: string, threshold: number, openMs: number): Promise<void>;
}

type CounterState = {
  count: number;
  resetAt: number;
};

type CircuitState = {
  failures: number;
  openUntil: number;
};

class InMemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, CounterState>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    this.store.set(key, existing);
    return { allowed: true, retryAfterSec: 0 };
  }
}

class InMemoryCircuitBreaker implements CircuitBreaker {
  private readonly store = new Map<string, CircuitState>();

  private getState(key: string): CircuitState {
    const existing = this.store.get(key);
    if (existing) return existing;
    const initial = { failures: 0, openUntil: 0 };
    this.store.set(key, initial);
    return initial;
  }

  async isOpen(key: string): Promise<boolean> {
    const state = this.getState(key);
    return state.openUntil > Date.now();
  }

  async recordSuccess(key: string): Promise<void> {
    this.store.set(key, { failures: 0, openUntil: 0 });
  }

  async recordFailure(key: string, threshold: number, openMs: number): Promise<void> {
    const state = this.getState(key);
    const failures = state.failures + 1;

    if (failures >= threshold) {
      this.store.set(key, {
        failures,
        openUntil: Date.now() + openMs,
      });
      return;
    }

    this.store.set(key, { failures, openUntil: state.openUntil });
  }
}

class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const redisKey = `chat:rl:${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }

    if (count > limit) {
      const pttl = await this.redis.pttl(redisKey);
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil(Math.max(pttl, 1) / 1000)),
      };
    }

    return { allowed: true, retryAfterSec: 0 };
  }
}

class RedisCircuitBreaker implements CircuitBreaker {
  constructor(private readonly redis: Redis) {}

  private key(id: string): string {
    return `chat:circuit:${id}`;
  }

  async isOpen(id: string): Promise<boolean> {
    const openUntilRaw = await this.redis.hget(this.key(id), "openUntil");
    const openUntil = openUntilRaw ? Number.parseInt(openUntilRaw, 10) : 0;
    return Number.isFinite(openUntil) && openUntil > Date.now();
  }

  async recordSuccess(id: string): Promise<void> {
    const key = this.key(id);
    await this.redis.hset(key, {
      failures: "0",
      openUntil: "0",
    });
    await this.redis.pexpire(key, 60_000);
  }

  async recordFailure(id: string, threshold: number, openMs: number): Promise<void> {
    const key = this.key(id);
    const currentFailuresRaw = await this.redis.hget(key, "failures");
    const currentFailures = currentFailuresRaw ? Number.parseInt(currentFailuresRaw, 10) : 0;
    const failures = Number.isFinite(currentFailures) ? currentFailures + 1 : 1;

    if (failures >= threshold) {
      const openUntil = Date.now() + openMs;
      await this.redis.hset(key, {
        failures: String(failures),
        openUntil: String(openUntil),
      });
      await this.redis.pexpire(key, openMs * 2);
      return;
    }

    await this.redis.hset(key, {
      failures: String(failures),
      openUntil: "0",
    });
    await this.redis.pexpire(key, 60_000);
  }
}

class FallbackRateLimiter implements RateLimiter {
  constructor(
    private readonly primary: RateLimiter,
    private readonly fallback: RateLimiter
  ) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    try {
      return await this.primary.consume(key, limit, windowMs);
    } catch {
      return this.fallback.consume(key, limit, windowMs);
    }
  }
}

class FallbackCircuitBreaker implements CircuitBreaker {
  constructor(
    private readonly primary: CircuitBreaker,
    private readonly fallback: CircuitBreaker
  ) {}

  async isOpen(key: string): Promise<boolean> {
    try {
      return await this.primary.isOpen(key);
    } catch {
      return this.fallback.isOpen(key);
    }
  }

  async recordSuccess(key: string): Promise<void> {
    try {
      await this.primary.recordSuccess(key);
      return;
    } catch {
      await this.fallback.recordSuccess(key);
    }
  }

  async recordFailure(key: string, threshold: number, openMs: number): Promise<void> {
    try {
      await this.primary.recordFailure(key, threshold, openMs);
      return;
    } catch {
      await this.fallback.recordFailure(key, threshold, openMs);
    }
  }
}

export type ChatResilienceManager = {
  backend: "redis" | "memory";
  rateLimiter: RateLimiter;
  circuitBreaker: CircuitBreaker;
};

declare global {
  var __chatResilienceManager: ChatResilienceManager | undefined;
  var __chatRedisClient: Redis | undefined;
}

function isRedisEnabled(): boolean {
  return process.env.REDIS_DISABLED !== "true";
}

function getRedisClient(): Redis | null {
  if (!isRedisEnabled()) return null;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!globalThis.__chatRedisClient) {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 times
        return Math.min(times * 50, 2000);
      }
    });

    client.on("error", (err) => {
      console.warn("[Redis] Connection error:", err.message);
    });

    globalThis.__chatRedisClient = client;
  }

  return globalThis.__chatRedisClient;
}

export function getChatResilienceManager(): ChatResilienceManager {
  if (globalThis.__chatResilienceManager) {
    return globalThis.__chatResilienceManager;
  }

  const memoryRateLimiter = new InMemoryRateLimiter();
  const memoryCircuitBreaker = new InMemoryCircuitBreaker();

  const redis = getRedisClient();
  if (!redis) {
    const memoryManager: ChatResilienceManager = {
      backend: "memory",
      rateLimiter: memoryRateLimiter,
      circuitBreaker: memoryCircuitBreaker,
    };
    globalThis.__chatResilienceManager = memoryManager;
    return memoryManager;
  }

  const redisRateLimiter = new RedisRateLimiter(redis);
  const redisCircuitBreaker = new RedisCircuitBreaker(redis);

  const redisManager: ChatResilienceManager = {
    backend: "redis",
    rateLimiter: new FallbackRateLimiter(redisRateLimiter, memoryRateLimiter),
    circuitBreaker: new FallbackCircuitBreaker(redisCircuitBreaker, memoryCircuitBreaker),
  };

  globalThis.__chatResilienceManager = redisManager;
  return redisManager;
}
