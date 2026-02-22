import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ id: string }>;
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

  const { data, error } = await admin
    .from("documents")
    .select("*, uploaded_by_user:users!documents_uploaded_by_fkey(name, email)")
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
 * Update document metadata (registrar only).
 */
export async function PATCH(req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  // Verify registrar role
  const { data: user } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!user || user.role !== "registrar") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowedFields = [
    "title", "visibility", "allow_ai_usage", "keywords",
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
    action: "document_updated",
    entity_type: "document",
    entity_id: id,
    metadata: updates as unknown as Record<string, string>,
  });

  return NextResponse.json(data);
}

/**
 * DELETE /api/documents/[id]
 *
 * Delete document and its file from storage (registrar only).
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  // Verify registrar
  const { data: user } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!user || user.role !== "registrar") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get document to find storage path
  const { data: doc } = await admin
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Delete from storage
  await admin.storage.from("documents").remove([doc.storage_path]);

  // Delete from database
  const { error } = await admin.from("documents").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // Audit
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "document_deleted",
    entity_type: "document",
    entity_id: id,
    metadata: { storage_path: doc.storage_path },
  });

  return NextResponse.json({ success: true });
}
