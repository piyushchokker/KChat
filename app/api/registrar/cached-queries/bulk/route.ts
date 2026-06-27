import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { z } from "zod";

async function resolveAuthorizedRegistrar(authId: string, email: string) {
  const admin = createAdminClient();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, auth_id, role, is_allowed")
    .eq("auth_id", authId)
    .maybeSingle();

  let registrar = byAuthId;

  // Recover auth_id drift for existing approved registrar accounts.
  if (!registrar && email) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail) {
      registrar = byEmail;

      if (byEmail.auth_id !== authId) {
        await admin.from("users").update({ auth_id: authId }).eq("id", byEmail.id);
      }
    }
  }

  if (!registrar || registrar.role !== "registrar" || registrar.is_allowed === false) {
    return { admin, registrar: null as null };
  }

  return { admin, registrar };
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * POST /api/registrar/cached-queries/bulk
 *
 * Registrar-only endpoint to bulk insert cached queries from CSV rows.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const { admin, registrar } = await resolveAuthorizedRegistrar(authUser.id, normalizedEmail);

  if (!registrar) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = z
    .object({
      rows: z
        .array(
          z.object({
            query: z.string().trim().min(1, "Query is required."),
            answer: z.string().trim().min(21, "Answer must be more than 20 characters."),
          })
        )
        .min(1, "No rows to insert."),
    })
    .safeParse(payload);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message || "Invalid request body" }, { status: 400 });
  }

  const insertRows = parsed.data.rows.map((row) => ({
    query: row.query.trim(),
    answer: row.answer.trim(),
    
    normalized_query: normalizeQuery(row.query),
    source_type: "csv_upload",
  }));

  const { data, error } = await admin
    .from("cached_quries")
    .insert(insertRows)
    .select(
      "id, query, answer, created_at"
    );

  if (error) {
    console.error("Failed to bulk insert cached queries:", error);
    return NextResponse.json({ error: "Failed to upload cached queries" }, { status: 500 });
  }

  return NextResponse.json({ cachedQueries: data ?? [], insertedCount: data?.length ?? 0 });
}

