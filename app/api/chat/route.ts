import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import type { Json } from "@/types/database";
import {
  getChatResilienceManager,
  type ChatResilienceManager,
} from "@/lib/chat-resilience";
import { getBackgroundWorker } from "@/lib/background-worker";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_USER_RATE_LIMIT = 40;
const DEFAULT_IP_RATE_LIMIT = 80;
const DEFAULT_MAX_QUERY_CHARS = 4_000;
const DEFAULT_MAX_QUERY_TOKENS = 1_000;
const DEFAULT_BACKEND_TIMEOUT_MS = 25_000;
const DEFAULT_BACKEND_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 400;
const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_OPEN_MS = 30_000;
const DEFAULT_TICKET_MISS_MESSAGE =
  "The knowledge base is currently offline, but I couldn't find the answer in my cache. I have created a support ticket with your student details. Our team will look into it!";
const FALLBACK_TICKET_MESSAGE =
  process.env.TICKET_MISS_MESSAGE?.trim() || DEFAULT_TICKET_MISS_MESSAGE;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StreamedAiResponse = {
  answer: string;
  confidence: number;
  sources: Json[];
  sessionId?: string;
  ragUsed?: boolean;
  ragRouterDecision?: "true" | "false" | "none";
  cacheHit?: boolean;
  cacheLayer?: "direct" | "validated" | "miss" | "knowledge_base";
  cacheScore?: number;
  canAnswer?: boolean;
  ticketRaised?: boolean;
  ticketId?: string | null;
};

type ResolvedAppUser = {
  id: string;
  name: string;
  email: string | null;
  roll_number: string | null;
  course: string | null;
  school: string | null;
  department: string | null;
  program: string | null;
};

function shouldRaiseStudentTicket(response: StreamedAiResponse): boolean {
  return (
    (response.cacheLayer === "miss" || response.canAnswer === false) &&
    response.ticketRaised !== true
  );
}

async function raiseStudentTicket(
  admin: ReturnType<typeof createAdminClient>,
  worker: ReturnType<typeof getBackgroundWorker>,
  params: {
    student: ResolvedAppUser;
    conversationId: string;
    messageId: string;
    raisedTicket: string;
    cacheLayer: "direct" | "validated" | "miss" | "knowledge_base" | null;
  }
) {
  const { student, conversationId, messageId, raisedTicket, cacheLayer } = params;
  const nowIso = new Date().toISOString();
  const normalizedQuery = raisedTicket.trim();

  if (!normalizedQuery) {
    return {
      id: null,
      raised: false,
    };
  }

  // Idempotency guard: avoid creating duplicate open tickets for same query in same conversation.
  const { data: existingOpenTicket } = await admin
    .from("tickets")
    .select("id")
    .eq("user_id", student.id)
    .eq("conversation_id", conversationId)
    .eq("query", normalizedQuery)
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingOpenTicket?.id) {
    return {
      id: existingOpenTicket.id as string,
      raised: true,
    };
  }

  let productionTicketId: string | null = null;

  const { data: productionTicketRow, error: productionTicketError } = await admin
    .from("tickets")
    .insert({
      conversation_id: conversationId,
      user_id: student.id,
      query: normalizedQuery,
      status: "open",
      priority: "medium",
      category: "chatbot_miss",
      confidence_score: 0,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (productionTicketError) {
    console.error("Failed to raise ticket in tickets:", productionTicketError.message);
  } else {
    productionTicketId = (productionTicketRow?.id as string | undefined) ?? null;
  }

  if (productionTicketId) {
    worker.enqueue("ticket-side-effects", async () => {
      const { error: ticketMessageError } = await admin.from("ticket_messages").insert({
        ticket_id: productionTicketId,
        sender_id: student.id,
        sender_type: "student",
        message: normalizedQuery,
        created_at: nowIso,
      });

      if (ticketMessageError) {
        console.error("Failed to insert ticket_messages row:", ticketMessageError.message);
      }

      const { error: ticketEventError } = await admin.from("ticket_events").insert({
        ticket_id: productionTicketId,
        event_type: "created",
        actor_id: student.id,
        metadata: {
          source: "kchat-api",
          cache_layer: cacheLayer,
          conversation_id: conversationId,
          message_id: messageId,
          student_name: student.name,
          student_email: student.email,
          roll_number: student.roll_number,
          student_course: student.course ?? student.program,
          student_school: student.school,
          department: student.department,
          program: student.program,
        },
        created_at: nowIso,
      });

      if (ticketEventError) {
        console.error("Failed to insert ticket_events row:", ticketEventError.message);
      }
    });
  }

  return {
    id: productionTicketId ?? null,
    raised: Boolean(productionTicketId),
  };
}

function getPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const first = forwardedFor.split(",")[0]?.trim();
  if (first) return first;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return "unknown";
}

function estimateTokenCount(text: string): number {
  // Lightweight estimate: ~4 chars/token for English-like text.
  return Math.ceil(text.length / 4);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    err.name === "AbortError"
  );
}

function parseRagUsedHeader(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function parseRagRouterDecisionHeader(
  value: string | null
): "true" | "false" | "none" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "false" || normalized === "none") {
    return normalized;
  }
  return undefined;
}

function parseCacheHitHeader(value: string | null): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function parseCacheLayerHeader(
  value: string | null
): "direct" | "validated" | "miss" | "knowledge_base" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "direct" ||
    normalized === "validated" ||
    normalized === "miss" ||
    normalized === "knowledge_base"
  ) {
    return normalized;
  }
  return undefined;
}

function parseCacheScoreHeader(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function waitMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  backendUrl: string,
  query: string,
  accessToken: string,
  sessionId?: string,
  studentContext?: {
    user_id: string;
    name: string;
    email: string | null;
    roll_number: string | null;
    course: string | null;
    school: string | null;
    department: string | null;
    program: string | null;
  }
): Promise<Response> {
  const timeoutMs = getPositiveIntEnv(
    "CHAT_BACKEND_TIMEOUT_MS",
    DEFAULT_BACKEND_TIMEOUT_MS
  );
  const retries = getPositiveIntEnv(
    "CHAT_BACKEND_RETRIES",
    DEFAULT_BACKEND_RETRIES
  );
  const baseDelayMs = getPositiveIntEnv(
    "CHAT_BACKEND_RETRY_BASE_DELAY_MS",
    DEFAULT_RETRY_BASE_DELAY_MS
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          query,
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(studentContext ? { student_context: studentContext } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (attempt < retries && isRetryableStatus(res.status)) {
          await waitMs(baseDelayMs * (attempt + 1));
          continue;
        }
        throw new Error(`Backend responded with ${res.status}`);
      }

      return res;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Backend request timed out"
            : err.message
          : "Backend request failed";
      lastError = new Error(message);

      if (attempt < retries && isRetryableError(lastError)) {
        await waitMs(baseDelayMs * (attempt + 1));
        continue;
      }

      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("Backend request failed");
}

/**
 * POST /api/chat
 *
 * Send a chat message and get an AI response.
 * Persists both user and assistant messages to Supabase.
 *
 * Body: { query: string, conversationId?: string, sessionId?: string }
 */
export async function POST(req: Request) {
  const requestStart = performance.now();
  const elapsedMs = () => performance.now() - requestStart;
  const worker = getBackgroundWorker();
  const resilience = getChatResilienceManager();
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authUser = session?.user;
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = session?.access_token;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication failed: missing session access token" },
      { status: 401 }
    );
  }

  const windowMs = getPositiveIntEnv(
    "CHAT_RATE_LIMIT_WINDOW_MS",
    DEFAULT_RATE_LIMIT_WINDOW_MS
  );
  const userLimit = getPositiveIntEnv(
    "CHAT_RATE_LIMIT_PER_USER",
    DEFAULT_USER_RATE_LIMIT
  );
  const ipLimit = getPositiveIntEnv(
    "CHAT_RATE_LIMIT_PER_IP",
    DEFAULT_IP_RATE_LIMIT
  );
  const clientIp = getClientIp(req);

  const [userLimitResult, ipLimitResult] = await Promise.all([
    resilience.rateLimiter.consume(`user:${authUser.id}`, userLimit, windowMs),
    resilience.rateLimiter.consume(`ip:${clientIp}`, ipLimit, windowMs),
  ]);

  if (!userLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(userLimitResult.retryAfterSec),
        },
      }
    );
  }

  if (!ipLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests from this network. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimitResult.retryAfterSec),
        },
      }
    );
  }

  const admin = createAdminClient();
  const body = await req.json();
  const { query, conversationId, sessionId } = body;
  const trimmedQuery = typeof query === "string" ? query.trim() : "";
  const trimmedConversationId =
    typeof conversationId === "string" && conversationId.trim().length > 0
      ? conversationId.trim()
      : undefined;
  const trimmedSessionId =
    typeof sessionId === "string" && sessionId.trim().length > 0
      ? sessionId.trim().toLowerCase()
      : undefined;

  // Get internal user
  const { data: user } = await admin
    .from("users")
    .select("id, name, email, roll_number, course, school, department, program")
    .eq("auth_id", authUser.id)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let appUser: ResolvedAppUser = {
    id: user.id,
    name: user.name ?? authUser.user_metadata?.name ?? "Student",
    email: user.email ?? authUser.email ?? null,
    roll_number: user.roll_number ?? null,
    course: user.course ?? user.program ?? null,
    school: user.school ?? null,
    department: user.department ?? null,
    program: user.program ?? user.course ?? null,
  };

  if (!trimmedQuery) {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }

  const maxChars = getPositiveIntEnv(
    "CHAT_MAX_QUERY_CHARS",
    DEFAULT_MAX_QUERY_CHARS
  );
  if (trimmedQuery.length > maxChars) {
    return NextResponse.json(
      { error: `Query exceeds maximum length of ${maxChars} characters` },
      { status: 400 }
    );
  }

  const maxTokens = getPositiveIntEnv(
    "CHAT_MAX_QUERY_TOKENS",
    DEFAULT_MAX_QUERY_TOKENS
  );
  if (estimateTokenCount(trimmedQuery) > maxTokens) {
    return NextResponse.json(
      { error: `Query exceeds token budget of ${maxTokens}` },
      { status: 400 }
    );
  }

  if (trimmedSessionId && !UUID_PATTERN.test(trimmedSessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  let activeConversationId = trimmedConversationId;
  let conversationSessionId: string | null = null;
  let existingSessionConversationId: string | null = null;

  if (trimmedSessionId) {
    const { data: sessionConversation } = await admin
      .from("conversations")
      .select("id, user_id")
      .eq("ret_session_id", trimmedSessionId)
      .maybeSingle();

    if (sessionConversation) {
      if (sessionConversation.user_id !== user.id) {
        return NextResponse.json(
          { error: "Session is not accessible" },
          { status: 403 }
        );
      }

      existingSessionConversationId = sessionConversation.id;
    }
  }

  if (!activeConversationId && existingSessionConversationId) {
    activeConversationId = existingSessionConversationId;
  }

  if (
    trimmedSessionId &&
    activeConversationId &&
    existingSessionConversationId &&
    existingSessionConversationId !== activeConversationId
  ) {
    return NextResponse.json(
      { error: "Session is already linked to another conversation" },
      { status: 409 }
    );
  }

  // Create new conversation if none provided
  if (!activeConversationId) {
    const title =
      trimmedQuery.length > 50 ? trimmedQuery.substring(0, 50) + "..." : trimmedQuery;

    const { data: conv, error: convError } = await admin
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
        ret_session_id: trimmedSessionId ?? null,
      })
      .select("id, ret_session_id")
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    activeConversationId = conv.id;
    conversationSessionId = conv.ret_session_id;
  } else {
    // Verify conversation belongs to user
    const { data: conv } = await admin
      .from("conversations")
      .select("id, ret_session_id")
      .eq("id", activeConversationId)
      .eq("user_id", user.id)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    conversationSessionId = conv.ret_session_id;

    if (
      trimmedSessionId &&
      conversationSessionId &&
      conversationSessionId !== trimmedSessionId
    ) {
      return NextResponse.json(
        { error: "Session does not match conversation" },
        { status: 409 }
      );
    }

    if (trimmedSessionId && !conversationSessionId) {
      const { error: attachSessionError } = await admin
        .from("conversations")
        .update({
          ret_session_id: trimmedSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeConversationId)
        .eq("user_id", user.id);

      if (attachSessionError) {
        return NextResponse.json(
          { error: "Failed to attach session" },
          { status: 500 }
        );
      }

      conversationSessionId = trimmedSessionId;
    }
  }

  const effectiveSessionId = trimmedSessionId ?? conversationSessionId ?? undefined;

  // Save user message
  const { data: userMsg, error: userMsgError } = await admin
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      role: "user",
      content: trimmedQuery,
    })
    .select()
    .single();

  if (userMsgError) {
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
  const preStreamMs = elapsedMs();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      enqueue("meta", {
        conversationId: activeConversationId,
        sessionId: effectiveSessionId,
        userMessage: {
          id: userMsg.id,
          role: userMsg.role,
          content: userMsg.content,
          timestamp: userMsg.created_at,
        },
      });

      (async () => {
        const backendStart = performance.now();
        let firstDeltaMs: number | null = null;

        const aiResponse = await streamPythonBackend(
          trimmedQuery,
          accessToken,
          effectiveSessionId,
          {
            user_id: appUser.id,
            name: appUser.name,
            email: appUser.email,
            roll_number: appUser.roll_number,
            course: appUser.course,
            school: appUser.school,
            department: appUser.department,
            program: appUser.program,
          },
          (delta) => {
            if (firstDeltaMs === null) {
              firstDeltaMs = performance.now() - backendStart;
            }
            enqueue("delta", { text: delta });
          },
          (statusMsg) => {
            enqueue("status", { message: statusMsg });
          },
          resilience
        );
        const backendStreamMs = performance.now() - backendStart;

        const shouldRaiseTicket = shouldRaiseStudentTicket(aiResponse);
        const normalizedAnswer = aiResponse.answer.trim();
        const assistantContent = shouldRaiseTicket
          ? normalizedAnswer || FALLBACK_TICKET_MESSAGE
          : normalizedAnswer;
        const assistantConfidence = shouldRaiseTicket ? 0 : aiResponse.confidence;
        const assistantSources = shouldRaiseTicket ? [] : aiResponse.sources;

        const { data: assistantMsg, error: assistantMsgError } = await admin
          .from("messages")
          .insert({
            conversation_id: activeConversationId,
            role: "assistant",
            content: assistantContent,
            sources: assistantSources,
            confidence: assistantConfidence,
          })
          .select()
          .single();

        if (assistantMsgError || !assistantMsg) {
          enqueue("error", { message: "Failed to save response" });
          return;
        }

        let raisedTicketInfo: { id: string | null; raised: boolean } | null = null;

        if (shouldRaiseTicket) {
          if ((!appUser.course || !appUser.school) && appUser.roll_number) {
            const { data: cachedProfile } = await admin
              .from("student_profile_cache")
              .select("course, school, department, student_email")
              .eq("user_id", user.id)
              .maybeSingle();

            if (cachedProfile) {
              appUser = {
                ...appUser,
                course: appUser.course ?? cachedProfile.course ?? null,
                school: appUser.school ?? cachedProfile.school ?? null,
                department: appUser.department ?? cachedProfile.department ?? null,
                email: appUser.email ?? cachedProfile.student_email ?? null,
              };
            }
          }

          raisedTicketInfo = await raiseStudentTicket(admin, worker, {
            student: appUser,
            conversationId: activeConversationId,
            messageId: assistantMsg.id,
            raisedTicket: trimmedQuery,
            cacheLayer: aiResponse.cacheLayer ?? null,
          });
        }

        const finalTicketRaised =
          aiResponse.ticketRaised === true ||
          (shouldRaiseTicket && (raisedTicketInfo?.raised ?? false));
        const finalTicketId = aiResponse.ticketId ?? raisedTicketInfo?.id ?? null;

        const normalizedResponseSessionId =
          typeof aiResponse.sessionId === "string" && aiResponse.sessionId.trim().length > 0
            ? aiResponse.sessionId.trim().toLowerCase()
            : undefined;
        const persistedSessionId = normalizedResponseSessionId ?? effectiveSessionId;

        worker.enqueue("conversation-touch", async () => {
          const { error: updateConversationError } = await admin
            .from("conversations")
            .update({
              updated_at: new Date().toISOString(),
              ret_session_id: persistedSessionId ?? null,
            })
            .eq("id", activeConversationId);

          if (updateConversationError) {
            console.error(
              "Failed to update conversation metadata:",
              updateConversationError.message
            );
          }
        });

        enqueue("done", {
          sessionId: persistedSessionId,
          ragUsed: aiResponse.ragUsed,
          ragRouterDecision: aiResponse.ragRouterDecision,
          cacheHit: aiResponse.cacheHit,
          cacheLayer: aiResponse.cacheLayer,
          cacheScore: aiResponse.cacheScore,
          ticketRaised: finalTicketRaised,
          ticketId: finalTicketId,
          timing: {
            apiPreStreamMs: preStreamMs,
            backendStreamMs,
            firstDeltaMs,
            totalApiMs: elapsedMs(),
          },
          assistantMessage: {
            id: assistantMsg.id,
            role: assistantMsg.role,
            content: assistantMsg.content,
            timestamp: assistantMsg.created_at,
            sources: assistantMsg.sources,
            confidence: assistantMsg.confidence,
          },
        });

        console.info("[chat timing]", {
          conversationId: activeConversationId,
          sessionId: persistedSessionId,
          apiPreStreamMs: preStreamMs,
          backendStreamMs,
          firstDeltaMs,
          totalApiMs: elapsedMs(),
          worker: worker.getStats(),
        });
      })()
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : "Unexpected streaming error";
          enqueue("error", { message });
        })
        .finally(() => {
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ----- Python RAG backend caller -----

function getStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : ""))
      .join("");
  }
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractDeltaText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const obj = payload as Record<string, unknown>;
  const candidates = [
    obj.word,
    obj.token,
    obj.chunk,
    obj.delta,
    obj.content,
    obj.text,
    obj.message,
    obj.response,
    obj.answer,
  ];

  for (const candidate of candidates) {
    const value = getStringValue(candidate);
    if (value) return value;
  }

  return "";
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function normalizeFinalPayload(payload: unknown): StreamedAiResponse {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const answer = extractDeltaText(obj);
    const confidence =
      typeof obj.confidence === "number" ? obj.confidence : 0.9;
    const sources = Array.isArray(obj.sources) ? (obj.sources as Json[]) : [];
    const canAnswer = typeof obj.can_answer === "boolean" ? obj.can_answer : undefined;
    const ticketRaised = typeof obj.ticket_raised === "boolean" ? obj.ticket_raised : undefined;
    const ticketId =
      typeof obj.ticket_id === "string"
        ? obj.ticket_id
        : obj.ticket_id === null
          ? null
          : undefined;
    return { answer, confidence, sources, canAnswer, ticketRaised, ticketId };
  }

  return {
    answer: getStringValue(payload),
    confidence: 0.9,
    sources: [],
  };
}

async function streamPythonBackend(
  query: string,
  accessToken: string,
  sessionId: string | undefined,
  studentContext:
    | {
        user_id: string;
        name: string;
        email: string | null;
        roll_number: string | null;
        course: string | null;
        school: string | null;
        department: string | null;
        program: string | null;
      }
    | undefined,
  onDelta: (delta: string) => void,
  onStatus: (message: string) => void,
  resilience: ChatResilienceManager
): Promise<StreamedAiResponse> {
  const rawBackendUrl = process.env.PYTHON_BACKEND_URL;
  if (!rawBackendUrl) {
    console.error("[Python Backend Error] PYTHON_BACKEND_URL is not set");
    return {
      answer: "I'm sorry, the knowledge base is not configured. Please contact support.",
      confidence: 0,
      sources: [],
    };
  }

  const backendUrl = `${rawBackendUrl.replace(/\/+$/, "")}/chat`;

  const circuitKey = `python:${backendUrl}`;
  const isCircuitOpen = await resilience.circuitBreaker.isOpen(circuitKey);
  if (isCircuitOpen) {
    return {
      answer:
        "I'm sorry, the knowledge service is temporarily overloaded. Please try again shortly.",
      confidence: 0,
      sources: [],
    };
  }

  try {
    const res = await fetchWithRetry(
      backendUrl,
      query,
      accessToken,
      sessionId,
      studentContext
    );
    const resolvedSessionId = res.headers.get("x-session-id") ?? sessionId;
    const ragUsed = parseRagUsedHeader(res.headers.get("x-rag-used"));
    const ragRouterDecision = parseRagRouterDecisionHeader(
      res.headers.get("x-rag-router-decision")
    );
    let cacheHit = parseCacheHitHeader(res.headers.get("x-cache-hit"));
    let cacheLayer = parseCacheLayerHeader(res.headers.get("x-cache-layer"));
    let cacheScore = parseCacheScoreHeader(res.headers.get("x-cache-score"));
    let canAnswer: boolean | undefined;
    let ticketRaised: boolean | undefined;
    let ticketId: string | null | undefined;

    const contentType = res.headers.get("content-type") ?? "";

    // Legacy or non-streaming backend response.
    if (contentType.includes("application/json")) {
      const payload = await res.json();
      const normalized = normalizeFinalPayload(payload);
      if (normalized.answer) {
        onDelta(normalized.answer);
      }
      return {
        ...normalized,
        sessionId: resolvedSessionId,
        ragUsed,
        ragRouterDecision,
        cacheHit,
        cacheLayer,
        cacheScore,
        canAnswer,
        ticketRaised,
        ticketId,
      };
    }

    if (!res.body) {
      throw new Error("Backend returned no stream body");
    }

    let fullAnswer = "";
    let confidence = 0.9;
    let sources: Json[] = [];

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    if (contentType.includes("text/event-stream")) {
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          let event = "message";
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart());
            }
          }

          if (dataLines.length === 0) continue;

          const raw = dataLines.join("\n");
          if (raw === "[DONE]") continue;

          const parsed = safeJsonParse(raw);

          if (event === "done" || event === "final" || event === "complete") {
            const normalized = normalizeFinalPayload(parsed);
            if (!fullAnswer && normalized.answer) {
              fullAnswer = normalized.answer;
            }
            confidence = normalized.confidence;
            sources = normalized.sources;

            // Extract cache info from Layer 2 done events
            if (parsed && typeof parsed === "object") {
              const doneObj = parsed as Record<string, unknown>;
              const doneCacheLayer = parseCacheLayerHeader(String(doneObj.cache_layer ?? ""));
              if (doneCacheLayer) cacheLayer = doneCacheLayer;
              const doneCacheScore = typeof doneObj.cache_score === "number" ? doneObj.cache_score : undefined;
              if (doneCacheScore !== undefined) cacheScore = doneCacheScore;
              if (typeof doneObj.can_answer === "boolean") {
                canAnswer = doneObj.can_answer;
              }
              if (doneObj.ticket_raised === true) {
                ticketRaised = true;
              } else if (doneObj.ticket_raised === false) {
                ticketRaised = false;
              }
              if (typeof doneObj.ticket_id === "string") {
                ticketId = doneObj.ticket_id;
              } else if (doneObj.ticket_id === null) {
                ticketId = null;
              }
              if (doneCacheLayer === "validated" || doneCacheLayer === "knowledge_base") cacheHit = true;
            }
            continue;
          }

          if (event === "status") {
            if (parsed && typeof parsed === "object") {
              const statusMsg = (parsed as Record<string, unknown>).message;
              if (typeof statusMsg === "string") {
                onStatus(statusMsg);
              }
            }
            continue;
          }

          const delta = extractDeltaText(parsed);
          if (delta) {
            fullAnswer += delta;
            onDelta(delta);
          }
        }
      }
    } else {
      // Plain text chunked stream.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        fullAnswer += chunk;
        onDelta(chunk);
      }
    }

    if (!fullAnswer) {
      fullAnswer =
        "I'm sorry, I couldn't generate a response right now. Please try again.";
    }

    await resilience.circuitBreaker.recordSuccess(circuitKey);

    return {
      answer: fullAnswer,
      confidence,
      sources,
      sessionId: resolvedSessionId,
      ragUsed,
      ragRouterDecision,
      cacheHit,
      cacheLayer,
      cacheScore,
      canAnswer,
      ticketRaised,
      ticketId,
    };
  } catch (err) {
    const threshold = getPositiveIntEnv(
      "CHAT_BACKEND_CIRCUIT_FAILURE_THRESHOLD",
      DEFAULT_CIRCUIT_FAILURE_THRESHOLD
    );
    const openMs = getPositiveIntEnv(
      "CHAT_BACKEND_CIRCUIT_OPEN_MS",
      DEFAULT_CIRCUIT_OPEN_MS
    );
    await resilience.circuitBreaker.recordFailure(circuitKey, threshold, openMs);
    console.error("[Python Backend Error]", err instanceof Error ? err.message : String(err));
    return {
      answer:
        "I'm sorry, I couldn't reach the knowledge base right now. Please try again in a moment.",
      confidence: 0,
      sources: [],
      sessionId,
    };
  }
}
