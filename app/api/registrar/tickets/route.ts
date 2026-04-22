import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

async function resolveAuthorizedRegistrar(authId: string, email: string) {
  const admin = createAdminClient();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, auth_id, role, is_allowed")
    .eq("auth_id", authId)
    .maybeSingle();

  let registrar = byAuthId;

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
    return { admin, registrar: null };
  }

  return { admin, registrar };
}

async function cleanupExpiredAnsweredTickets(admin: ReturnType<typeof createAdminClient>) {
  const nowIso = new Date().toISOString();

  await admin
    .from("student_raised_tickets")
    .delete()
    .eq("no_expiry", false)
    .not("answered_at", "is", null)
    .not("valid_till", "is", null)
    .lt("valid_till", nowIso);
}

/**
 * GET /api/registrar/tickets
 *
 * Registrar-only endpoint to list raised student tickets.
 * Expired answered tickets are automatically deleted.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const { admin, registrar } = await resolveAuthorizedRegistrar(
    authUser.id,
    normalizedEmail
  );

  if (!registrar) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await cleanupExpiredAnsweredTickets(admin);

  const { data, error } = await admin
    .from("student_raised_tickets")
    .select(
      "id, student_id, student_name, roll_number, student_course, raised_ticket, raised_at, resolved_answer, answered_at, valid_from, valid_till, no_expiry, conversation_id"
    )
    .order("raised_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch raised tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch raised tickets" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tickets: data ?? [] });
}
