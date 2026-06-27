import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveDeleteDocumentEndpoint(): string | null {
  const pythonBackendUrl = process.env.PYTHON_BACKEND_URL?.trim();
  if (pythonBackendUrl) {
    try {
      const backendOrigin = new URL(pythonBackendUrl).origin;
      return `${normalizeUrl(backendOrigin)}/delete-document`;
    } catch {
      // Ignore invalid URL and continue to legacy fallback.
    }
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiBase) {
    return null;
  }

  return `${normalizeUrl(apiBase)}/delete-document`;
}

async function extractBackendErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  const payload = await response.json().catch(() => null) as
    | { error?: unknown; message?: unknown; detail?: unknown }
    | null;

  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  return fallbackMessage;
}

/**
 * GET /api/documents/[id]
 */
export async function GET(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: currentUser } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .single();

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (currentUser.is_allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPrivilegedUser =
    currentUser.role === "registrar" || currentUser.role === "admin";
  const studentSelect =
    "id, title, file_name, file_url, file_size, type_id, document_types(name), school_id, schools(name), course_id, courses(name), semester, effective_from, effective_till, issuing_authority, created_at, updated_at";
  const registrarSelect =
    `${studentSelect}, storage_path, uploaded_by, uploaded_by_user:users!documents_uploaded_by_fkey(name, email)`;
  const selectColumns = isPrivilegedUser ? registrarSelect : studentSelect;

  const { data, error } = await admin
    .from("documents")
    .select(selectColumns)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/documents/[id]
 *
 * Update document metadata (admin/registrar only).
 */
export async function PATCH(req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  // Verify admin/registrar role
  const { data: user } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .single();

  const canManageDocuments =
    user &&
    (user.role === "registrar" || user.role === "admin") &&
    user.is_allowed !== false;

  if (!canManageDocuments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowedFields = [
    "title", "visibility", "allow_ai_usage",
    "effective_from", "effective_till", "version",
  ];

  const updates: Record<string, string | boolean | string[]> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data, error } = await admin
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Audit
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: user.role === "admin" ? "document_updated_by_admin" : "document_updated",
    entity_type: "document",
    entity_id: id,
    metadata: updates as unknown as Record<string, string>,
  });

  return NextResponse.json(data);
}

/**
 * DELETE /api/documents/[id]
 *
 * Delete document and its file from storage (admin/registrar only).
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  // Verify admin/registrar
  const { data: user } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .single();

  const canManageDocuments =
    user &&
    (user.role === "registrar" || user.role === "admin") &&
    user.is_allowed !== false;

  if (!canManageDocuments) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleteDocumentEndpoint = resolveDeleteDocumentEndpoint();
  if (!deleteDocumentEndpoint) {
    return NextResponse.json(
      { error: "Delete endpoint is not configured" },
      { status: 500 }
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const backendResponse = await fetch(deleteDocumentEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    body: JSON.stringify({ uuid: id }),
  });

  if (!backendResponse.ok) {
    const message = await extractBackendErrorMessage(
      backendResponse,
      "Failed to delete document from backend"
    );

    return NextResponse.json({ error: message }, { status: backendResponse.status });
  }

  // Get document to find storage path
  const { data: doc } = await admin
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  // Best-effort storage cleanup. Backend may already have removed the record/file.
  if (doc?.storage_path) {
    await admin.storage.from("documents").remove([doc.storage_path]);
  }

  // Delete from database
  const { error } = await admin.from("documents").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // Audit
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: user.role === "admin" ? "document_deleted_by_admin" : "document_deleted",
    entity_type: "document",
    entity_id: id,
    metadata: { storage_path: doc?.storage_path ?? null },
  });

  return NextResponse.json({ success: true });
}
