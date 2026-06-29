import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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
 * PATCH /api/registrar/tickets/[id]
 *
 * Registrar-only endpoint to answer a ticket.
 * Updates ticket status to 'resolved', inserts the answer as a ticket_message,
 * adds to resolved_knowledge for future AI reference, and logs the event.
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
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const { admin, registrar } = await resolveAuthorizedRegistrar(
    authUser.id,
    normalizedEmail
  );

  if (!registrar) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const answer = normalizeText(body.answer);
  if (!answer) {
    return NextResponse.json(
      { error: "Answer is required" },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();

  // 1. Verify ticket exists and fetch its query for resolved_knowledge
  const { data: existingTicket } = await admin
    .from("tickets")
    .select("id, query, status, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existingTicket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // 2. Update ticket status to resolved
  const { error: updateError } = await admin
    .from("tickets")
    .update({
      status: "resolved",
      resolved_at: nowIso,
      assigned_to: registrar.id,
      updated_at: nowIso,
    })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to update ticket:", updateError);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }

  // 3. Insert the registrar's answer as a ticket message
  const { error: msgError } = await admin
    .from("ticket_messages")
    .insert({
      ticket_id: id,
      sender_id: registrar.id,
      sender_type: "admin",
      message: answer,
    });

  if (msgError) {
    console.error("Failed to insert ticket message:", msgError);
  }

  // 4. Add to resolved_knowledge for future AI reference
  const { error: knowledgeError } = await admin
    .from("resolved_knowledge")
    .insert({
      ticket_id: id,
      question: existingTicket.query,
      answer: answer,
    });

  if (knowledgeError) {
    console.error("Failed to insert resolved knowledge:", knowledgeError);
  }

  // 4b. Add to cached_quries for Excel cache / query tracking
  const { error: cachedQueryError } = await admin.from("cached_quries").insert({
    query: existingTicket.query,
    answer: answer,
  });

  if (cachedQueryError) {
    console.error("Failed to insert cached query:", cachedQueryError);
  }

  // 5. Log the resolution event
  await admin.from("ticket_events").insert({
    ticket_id: id,
    event_type: "resolved",
    actor_id: registrar.id,
    metadata: { answered_by: registrar.id },
  });

  // 6. Audit log
  await admin.from("audit_logs").insert({
    user_id: registrar.id,
    action: "ticket_resolved",
    entity_type: "ticket",
    entity_id: id,
    metadata: {
      answered_by: registrar.id,
      ticket_user_id: existingTicket.user_id,
    },
  });

  // 7. Fetch the updated ticket with user info
  const { data: updatedTicket, error: fetchError } = await admin
    .from("tickets")
    .select(
      "id, query, status, priority, category, conversation_id, user_id, assigned_to, created_at, updated_at, resolved_at, users!tickets_user_id_fkey(name, email, roll_number, course, school)"
    )
    .eq("id", id)
    .single();

  if (fetchError || !updatedTicket) {
    console.error("Failed to fetch updated ticket:", fetchError);
  }

  const user = updatedTicket?.users as any;

  return NextResponse.json({
    ticket: {
      id: updatedTicket?.id ?? id,
      query: updatedTicket?.query ?? existingTicket.query,
      status: updatedTicket?.status ?? "resolved",
      priority: updatedTicket?.priority,
      category: updatedTicket?.category,
      conversation_id: updatedTicket?.conversation_id,
      user_id: updatedTicket?.user_id ?? existingTicket.user_id,
      assigned_to: updatedTicket?.assigned_to,
      created_at: updatedTicket?.created_at,
      updated_at: updatedTicket?.updated_at,
      resolved_at: updatedTicket?.resolved_at ?? nowIso,
      student_name: user?.name ?? "Unknown",
      student_email: user?.email ?? "",
      roll_number: user?.roll_number ?? null,
      student_course: user?.course ?? null,
      student_school: user?.school ?? null,
    },
  });
}

/**
 * DELETE /api/registrar/tickets/[id]
 *
 * Registrar-only endpoint to delete a ticket and related metadata.
 */
export async function DELETE(_: Request, context: RouteContext) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const { admin, registrar } = await resolveAuthorizedRegistrar(
    authUser.id,
    normalizedEmail
  );

  if (!registrar) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existingTicket } = await admin
    .from("tickets")
    .select("id, query, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existingTicket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Delete related records first (cascade handles most, but be explicit)
  const { error: msgError } = await admin
    .from("ticket_messages")
    .delete()
    .eq("ticket_id", id);

  if (msgError) {
    console.error("Failed to delete ticket_messages:", msgError);
    return NextResponse.json(
      { error: "Failed to delete ticket messages" },
      { status: 500 }
    );
  }

  const { error: eventsError } = await admin
    .from("ticket_events")
    .delete()
    .eq("ticket_id", id);

  if (eventsError) {
    console.error("Failed to delete ticket_events:", eventsError);
    return NextResponse.json(
      { error: "Failed to delete ticket events" },
      { status: 500 }
    );
  }

  const { error: knowledgeError } = await admin
    .from("resolved_knowledge")
    .delete()
    .eq("ticket_id", id);

  if (knowledgeError) {
    console.error("Failed to delete resolved_knowledge:", knowledgeError);
    return NextResponse.json(
      { error: "Failed to delete resolved knowledge" },
      { status: 500 }
    );
  }

  const { error: ticketDeleteError } = await admin
    .from("tickets")
    .delete()
    .eq("id", id);

  if (ticketDeleteError) {
    console.error("Failed to delete ticket:", ticketDeleteError);
    return NextResponse.json(
      { error: "Failed to delete ticket" },
      { status: 500 }
    );
  }

  await admin.from("audit_logs").insert({
    user_id: registrar.id,
    action: "ticket_deleted",
    entity_type: "ticket",
    entity_id: id,
    metadata: {
      ticket_user_id: existingTicket.user_id,
      query: existingTicket.query,
    },
  });

  return NextResponse.json({ success: true, id });
}
