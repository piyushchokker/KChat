import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RetHistoryMessage = {
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
};

function getSessionBaseUrl(): string | null {
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

/**
 * GET /api/chat/session/[sessionId]/history
 *
 * Returns RET message history for a specific UUID session.
 */
export async function GET(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const normalizedSessionId = sessionId.trim().toLowerCase();

  if (!UUID_PATTERN.test(normalizedSessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const sessionBaseUrl = getSessionBaseUrl();
  if (!sessionBaseUrl) {
    return NextResponse.json(
      { error: "Session backend URL is not configured" },
      { status: 500 }
    );
  }

  const historyUrl = `${sessionBaseUrl}/${encodeURIComponent(normalizedSessionId)}/history`;

  try {
    const backendResponse = await fetch(historyUrl, {
      headers: { "ngrok-skip-browser-warning": "true" },
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: "Failed to load session history" },
        { status: 502 }
      );
    }

    const payload = (await backendResponse.json()) as {
      messages?: RetHistoryMessage[];
    };

    const messages = Array.isArray(payload.messages)
      ? payload.messages
          .map((message) => ({
            role: typeof message.role === "string" ? message.role : "",
            content: typeof message.content === "string" ? message.content : "",
            timestamp: message.timestamp ?? null,
          }))
          .filter(
            (message) =>
              (message.role === "user" || message.role === "assistant") &&
              message.content.trim().length > 0
          )
      : [];

    return NextResponse.json({
      sessionId: normalizedSessionId,
      messages,
    });
  } catch (err) {
    console.error(
      "[RET Session History Error]",
      err instanceof Error ? err.message : String(err)
    );

    return NextResponse.json(
      { error: "Failed to load session history" },
      { status: 502 }
    );
  }
}
