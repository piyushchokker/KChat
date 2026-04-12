import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

function sanitizeSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9\s._-]/g, " ").trim();
}

/**
 * GET /api/admin/registrars
 *
 * Admin-only endpoint to list registrar accounts.
 */
export async function GET(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { searchParams } = new URL(req.url);
  const search = sanitizeSearch(searchParams.get("q") ?? "");

  let query = admin
    .from("users")
    .select(
      "id, auth_id, email, name, role, department, designation, created_at, updated_at, is_allowed"
    )
    .eq("role", "registrar")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,department.ilike.%${search}%,designation.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch registrars:", error);
    return NextResponse.json({ error: "Failed to fetch registrars" }, { status: 500 });
  }

  return NextResponse.json({ registrars: data ?? [] });
}
