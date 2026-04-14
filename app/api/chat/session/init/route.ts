import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionInitFailure = "auth_failed" | "not_allowed" | "session_init_failed";

type SessionInitResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: SessionInitFailure };

function getSessionCreateUrl(): string | null {
  const explicit = process.env.PYTHON_BACKEND_SESSION_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const chatUrl = process.env.PYTHON_BACKEND_URL?.trim();
  if (!chatUrl) {
    return null;
  }

  try {
    const parsed = new URL(chatUrl);
    if (/\/chat\/?$/i.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\/chat\/?$/i, "/session");
    } else {
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/session`;
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function extractSessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate =
    (payload as { session_id?: unknown }).session_id ??
    (payload as { sessionId?: unknown }).sessionId;

  if (typeof candidate !== "string") {
    return null;
  }

  const normalized = candidate.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function redirectTo(req: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url));
}

function getFailureRedirectPath(reason: SessionInitFailure): string {
  if (reason === "not_allowed") {
    return "/student/banned";
  }

  if (reason === "auth_failed") {
    return "/student/login?error=auth_failed";
  }

  return "/student/login?error=session_init_failed";
}

function getFailureStatus(reason: SessionInitFailure): number {
  if (reason === "auth_failed") {
    return 401;
  }

  if (reason === "not_allowed") {
    return 403;
  }

  return 502;
}

function getFailureMessage(reason: SessionInitFailure): string {
  if (reason === "auth_failed") {
    return "Authentication failed";
  }

  if (reason === "not_allowed") {
    return "Access denied";
  }

  return "Failed to initialize chat session";
}

async function initializeSession(): Promise<SessionInitResult> {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { ok: false, reason: "auth_failed" };
  }

  const access = await verifyStudentAccess(authUser);
  if (!access.ok) {
    return {
      ok: false,
      reason: access.reason === "not_allowed" ? "not_allowed" : "auth_failed",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    return { ok: false, reason: "auth_failed" };
  }

  const sessionCreateUrl = getSessionCreateUrl();
  if (!sessionCreateUrl) {
    return { ok: false, reason: "session_init_failed" };
  }

  try {
    const response = await fetch(sessionCreateUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "ngrok-skip-browser-warning": "true",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: "auth_failed" };
      }

      return { ok: false, reason: "session_init_failed" };
    }

    const payload = await response.json();
    const sessionId = extractSessionId(payload);

    if (!sessionId) {
      return { ok: false, reason: "session_init_failed" };
    }

    return { ok: true, sessionId };
  } catch {
    return { ok: false, reason: "session_init_failed" };
  }
}

/**
 * GET /api/chat/session/init
 *
 * Creates a new RET session id server-side and redirects to /student/chat/[sessionId].
 */
export async function GET(req: Request) {
  const result = await initializeSession();

  if (!result.ok) {
    return redirectTo(req, getFailureRedirectPath(result.reason));
  }

  return redirectTo(req, `/student/chat/${encodeURIComponent(result.sessionId)}`);
}

/**
 * POST /api/chat/session/init
 *
 * Creates a new RET session id server-side and returns JSON.
 */
export async function POST() {
  const result = await initializeSession();

  if (!result.ok) {
    return NextResponse.json(
      { error: getFailureMessage(result.reason) },
      { status: getFailureStatus(result.reason) }
    );
  }

  return NextResponse.json({
    sessionId: result.sessionId,
    session_id: result.sessionId,
  });
}
