import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoDate(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
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
 * Registrar-only endpoint to answer a raised ticket with validity controls.
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

  const noExpiry = body.no_expiry === true;

  let validFrom: string | null = null;
  let validTill: string | null = null;

  if (!noExpiry) {
    const validFromInput = normalizeText(body.valid_from);
    const validTillInput = normalizeText(body.valid_till);

    if (!validFromInput || !validTillInput) {
      return NextResponse.json(
        {
          error:
            "valid_from and valid_till are required unless no_expiry is enabled",
        },
        { status: 400 }
      );
    }

    validFrom = toIsoDate(validFromInput);
    validTill = toIsoDate(validTillInput);

    if (!validFrom || !validTill) {
      return NextResponse.json(
        { error: "valid_from and valid_till must be valid dates" },
        { status: 400 }
      );
    }

    if (Date.parse(validTill) < Date.parse(validFrom)) {
      return NextResponse.json(
        { error: "valid_till must be after valid_from" },
        { status: 400 }
      );
    }
  }

  const nowIso = new Date().toISOString();

  const { data: existingTicket } = await admin
    .from("student_raised_tickets")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!existingTicket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const { data: updatedTicket, error: updateError } = await admin
    .from("student_raised_tickets")
    .update({
      resolved_answer: answer,
      answered_by: registrar.id,
      answered_at: nowIso,
      no_expiry: noExpiry,
      valid_from: noExpiry ? null : validFrom,
      valid_till: noExpiry ? null : validTill,
      updated_at: nowIso,
    })
    .eq("id", id)
    .select(
      "id, student_id, student_name, roll_number, student_course, raised_ticket, raised_at, resolved_answer, answered_at, valid_from, valid_till, no_expiry, conversation_id"
    )
    .single();

  if (updateError || !updatedTicket) {
    console.error("Failed to answer raised ticket:", updateError);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }

  await admin.from("audit_logs").insert({
    user_id: registrar.id,
    action: "student_ticket_answered",
    entity_type: "student_raised_ticket",
    entity_id: id,
    metadata: {
      no_expiry: noExpiry,
      valid_from: noExpiry ? null : validFrom,
      valid_till: noExpiry ? null : validTill,
    },
  });

  return NextResponse.json({ ticket: updatedTicket });
}
