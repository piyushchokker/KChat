This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Create `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `SUPABASE_SECRET_KEY`
- `PYTHON_BACKEND_URL`
- `PYTHON_BACKEND_SESSION_URL` (optional)
- `TRUSTED_EMAIL_DOMAINS`
- `NEXT_PUBLIC_DEBUG_REGISTRAR_UPLOAD` (optional, default `false`)
- `DEBUG_REGISTRAR_UPLOAD` (optional, default `false`)
- `DEBUG_REGISTRAR_UPLOAD_MAX_JSON_BYTES` (optional, default `1048576`)
- `CHAT_RATE_LIMIT_WINDOW_MS`
- `CHAT_RATE_LIMIT_PER_USER`
- `CHAT_RATE_LIMIT_PER_IP`
- `CHAT_MAX_QUERY_CHARS`
- `CHAT_MAX_QUERY_TOKENS`
- `CHAT_BACKEND_TIMEOUT_MS`
- `CHAT_BACKEND_RETRIES`
    - `CHAT_BACKEND_RETRY_BASE_DELAY_MS`
- `CHAT_BACKEND_CIRCUIT_FAILURE_THRESHOLD`
- `CHAT_BACKEND_CIRCUIT_OPEN_MS`
- `REDIS_URL`
- `REDIS_DISABLED`

Registrar upload debugging:

- Set `NEXT_PUBLIC_DEBUG_REGISTRAR_UPLOAD=true` to log full upload request payload in browser console.
- Set `DEBUG_REGISTRAR_UPLOAD=true` to log full upload payload in the Next.js server terminal.
- For `.json`/`.jsonl` uploads, server logs include full file text up to `DEBUG_REGISTRAR_UPLOAD_MAX_JSON_BYTES`.

Redis-backed resilience:

- Chat rate limits and circuit breaker state use Redis when `REDIS_URL` is set.
- If Redis is not configured or temporarily unavailable, the app falls back to in-memory limits.
- In-memory fallback works for local development but is per-instance only.

Role assignment hardening:

- Privileged roles (`admin`, `registrar`) are enforced from `public.users` only.
- Login flows sync auth users but do not grant privileged roles from client input or email heuristics.
- Set and approve privileged roles server-side in Supabase (`role` + `is_allowed`).

Security rules:

- Never commit `.env.local`.
- Never share server secret keys in chat, screenshots, or logs.
- If a key is exposed, rotate it immediately in Supabase Dashboard.

### Key Rotation Checklist

1. Rotate leaked keys in Supabase Dashboard.
2. Update deployment secret manager values (Vercel, etc.).
3. Update local `.env.local` values.
4. Restart local dev server and redeploy.
5. Invalidate old leaked values everywhere they were stored/shared.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
