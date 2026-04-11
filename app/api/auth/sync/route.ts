import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

const DEFAULT_TRUSTED_DOMAINS = ["krmangalam.edu.in", "krmu.edu.in"];

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

type ExistingUser = {
  id: string;
  auth_id: string;
  role: string;
  is_allowed: boolean;
};

function isSameOriginMutation(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const expectedOrigin = `${proto}://${host}`;

  const origin = req.headers.get("origin");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    return referer.startsWith(`${expectedOrigin}/`);
  }

  // If neither header exists, fail closed for this mutating route.
  return false;
}

/**
 * POST /api/auth/sync
 *
 * Ensures the current Supabase user exists in the users table.
 * Called on first login or when user data needs refreshing.
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const trustedDomains = parseCsvEnv(process.env.TRUSTED_EMAIL_DOMAINS);
  const allowedDomains =
    trustedDomains.length > 0 ? trustedDomains : DEFAULT_TRUSTED_DOMAINS;
  const emailDomain = getEmailDomain(email);

  if (!allowedDomains.includes(emailDomain)) {
    return NextResponse.json({ error: "Email domain is not allowed" }, { status: 403 });
  }

  const meta = user.user_metadata ?? {};

  // Microsoft Azure: extract actual name (strip roll number from full_name)
  const rawName = meta.given_name || meta.name || meta.full_name || email;
  const name = rawName.replace(/\d+/g, "").trim();
  // Roll number = part before "@" in the email (e.g. 2501940081@krmu.edu.in)
  const rollNumber = email.includes("@") ? email.split("@")[0] : null;

  // Server-side mapping from users table: preserve existing approved role and access.
  // Check auth_id first so a synced registrar cannot be downgraded by email mismatch/casing issues.
  const { data: existingByAuth } = await admin
    .from("users")
    .select("id, auth_id, role, is_allowed")
    .eq("auth_id", user.id)
    .maybeSingle();

  let existingUser: ExistingUser | null = existingByAuth;
  if (!existingUser) {
    const { data: existingByEmail } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed")
      .ilike("email", email)
      .maybeSingle();
    existingUser = existingByEmail;
  }

  if (existingUser && !existingUser.is_allowed) {
    return NextResponse.json(
      { error: "Your account is not approved" },
      { status: 403 }
    );
  }

  const role = existingUser?.role ?? "student";
  const isAllowed = existingUser?.is_allowed ?? true;

  const userPayload = {
    auth_id: user.id,
    email,
    name,
    role,
    is_allowed: isAllowed,
    roll_number: role === "student" ? rollNumber : null,
    image_url: meta.avatar_url ?? null,
  };

  const query = existingUser
    ? admin.from("users").update(userPayload).eq("id", existingUser.id)
    : admin.from("users").insert(userPayload);

  const { data, error } = await query.select().single();

  if (error) {
    console.error("Failed to sync user:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
