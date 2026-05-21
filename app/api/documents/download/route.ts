import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 minutes

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function sanitizeFilename(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  // Prevent header/path issues
  const noPath = trimmed.replace(/[\\\/]/g, "_");
  const safe = noPath.replace(/["']/g, "");
  return safe.slice(0, 180);
}

function filenameFromPath(storagePath: string): string {
  const parts = (storagePath || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function contentDisposition(filename: string): string {
  const fallback = filename || "document";
  // RFC 5987 for UTF-8 filenames
  const encoded = encodeURIComponent(fallback);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * GET /api/documents/download?path=<storage_path>
 *
 * Creates a short-lived signed URL (5 minutes) for a storage object and redirects.
 * Uses the same Supabase project as the Next.js app, avoiding cross-project bucket issues.
 */
export async function GET(req: Request) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const storagePath = url.searchParams.get("path")?.trim() ?? "";
  const filenameParam = url.searchParams.get("filename")?.trim() ?? "";
  if (!storagePath) {
    return badRequest("Missing storage path");
  }

  const admin = createAdminClient();
  const { data: currentUser } = await admin
    .from("users")
    .select("id, is_allowed")
    .eq("auth_id", authUser.id)
    .single();

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (currentUser.is_allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve the best filename:
  // 1) explicit ?filename=...
  // 2) documents table (file_name/title) by storage_path
  // 3) last segment of storage path
  let resolvedFilename = sanitizeFilename(filenameParam);

  if (!resolvedFilename) {
    const { data: docRow } = await admin
      .from("documents")
      .select("file_name, title")
      .eq("storage_path", storagePath)
      .maybeSingle();

    const fromDb =
      (typeof docRow?.file_name === "string" ? docRow.file_name : "") ||
      (typeof docRow?.title === "string" ? docRow.title : "");
    resolvedFilename = sanitizeFilename(fromDb) || sanitizeFilename(filenameFromPath(storagePath));
  }

  const filename = resolvedFilename || "document";
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, { download: filename });

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  // Stream bytes from the signed URL back to the browser as a same-origin download.
  // This avoids cases where a redirect gets saved as an HTML file (leading to "not openable").
  const upstream = await fetch(data.signedUrl, { redirect: "follow" });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: message || `Failed to download file (${upstream.status})` },
      { status: 502 }
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);

  // Force download with the original filename.
  headers.set("content-disposition", contentDisposition(filename));
  headers.set("cache-control", "no-store");

  return new Response(upstream.body, { status: 200, headers });
}
