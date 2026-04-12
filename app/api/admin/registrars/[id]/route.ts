import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type RegistrarUpdatePayload = {
  name?: string;
  email?: string;
  department?: string | null;
  designation?: string | null;
  is_allowed?: boolean;
};

function normalizeNullableText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * PATCH /api/admin/registrars/[id]
 *
 * Admin-only endpoint to update registrar details.
 */
export async function PATCH(req: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing registrar id" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: actor } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!actor || actor.role !== "admin" || actor.is_allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existingRegistrar } = await admin
    .from("users")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();

  if (!existingRegistrar || existingRegistrar.role !== "registrar") {
    return NextResponse.json({ error: "Registrar not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: RegistrarUpdatePayload = {};

  const name = normalizeNullableText(body.name);
  if (name !== undefined) {
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = name;
  }

  const email = normalizeNullableText(body.email);
  if (email !== undefined) {
    if (!email) {
      return NextResponse.json({ error: "Email cannot be empty" }, { status: 400 });
    }
    updates.email = email.toLowerCase();
  }

  const department = normalizeNullableText(body.department);
  if (department !== undefined) {
    updates.department = department;
  }

  const designation = normalizeNullableText(body.designation);
  if (designation !== undefined) {
    updates.designation = designation;
  }

  if (typeof body.is_allowed === "boolean") {
    updates.is_allowed = body.is_allowed;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updatedRegistrar, error: updateError } = await admin
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id, auth_id, email, name, role, department, designation, created_at, updated_at, is_allowed"
    )
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    console.error("Failed to update registrar:", updateError);
    return NextResponse.json({ error: "Failed to update registrar" }, { status: 500 });
  }

  await admin.from("audit_logs").insert({
    user_id: actor.id,
    action: "registrar_updated_by_admin",
    entity_type: "user",
    entity_id: id,
    metadata: updates as Record<string, string>,
  });

  return NextResponse.json(updatedRegistrar);
}
