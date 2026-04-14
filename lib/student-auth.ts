import { createAdminClient } from "@/lib/supabase-server";

const DEFAULT_TRUSTED_DOMAINS = ["krmangalam.edu.in", "krmu.edu.in"];

type AuthUserLike = {
  id: string;
  email?: string | null;
};

type StudentAccessFailureReason =
  | "missing_email"
  | "domain_not_allowed"
  | "not_student"
  | "not_allowed"
  | "lookup_failed";

type StudentAccessResult =
  | { ok: true; email: string }
  | { ok: false; reason: StudentAccessFailureReason };

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase();
}

export async function verifyStudentAccess(
  authUser: AuthUserLike
): Promise<StudentAccessResult> {
  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, reason: "missing_email" };
  }

  const trustedDomains = parseCsvEnv(process.env.TRUSTED_EMAIL_DOMAINS);
  const allowedDomains =
    trustedDomains.length > 0 ? trustedDomains : DEFAULT_TRUSTED_DOMAINS;

  if (!allowedDomains.includes(getEmailDomain(normalizedEmail))) {
    return { ok: false, reason: "domain_not_allowed" };
  }

  try {
    const admin = createAdminClient();

    const { data: byAuthId, error: byAuthIdError } = await admin
      .from("users")
      .select("id, role, is_allowed")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (byAuthIdError) {
      return { ok: false, reason: "lookup_failed" };
    }

    let profile = byAuthId;

    if (!profile) {
      const { data: byEmail, error: byEmailError } = await admin
        .from("users")
        .select("id, role, is_allowed")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (byEmailError) {
        return { ok: false, reason: "lookup_failed" };
      }

      profile = byEmail;
    }

    // Allow first-time students to proceed. The chat session page will upsert profile.
    if (!profile) {
      return { ok: true, email: normalizedEmail };
    }

    if (profile.is_allowed === false) {
      return { ok: false, reason: "not_allowed" };
    }

    if (profile.role !== "student") {
      return { ok: false, reason: "not_student" };
    }

    return { ok: true, email: normalizedEmail };
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }
}