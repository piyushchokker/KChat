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

/**
 * GET /api/registrar/tickets
 *
 * Registrar-only endpoint to list all tickets raised by students.
 * Joins with users table for student details.
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

  const { data, error } = await admin
    .from("tickets")
    .select(
      "id, query, status, priority, category, confidence_score, conversation_id, user_id, assigned_to, created_at, updated_at, resolved_at, users!tickets_user_id_fkey(name, email, roll_number, course, school)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch tickets:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }

  // Transform the data to flatten user info
  const tickets = (data ?? []).map((ticket) => {
    const user = ticket.users as { name: string; email: string; roll_number: string | null; course: string | null; school: string | null } | null;
    return {
      id: ticket.id,
      query: ticket.query,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      confidence_score: ticket.confidence_score,
      conversation_id: ticket.conversation_id,
      user_id: ticket.user_id,
      assigned_to: ticket.assigned_to,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      resolved_at: ticket.resolved_at,
      student_name: user?.name ?? "Unknown",
      student_email: user?.email ?? "",
      roll_number: user?.roll_number ?? null,
      student_course: user?.course ?? null,
      student_school: user?.school ?? null,
    };
  });

  return NextResponse.json({ tickets });
}
