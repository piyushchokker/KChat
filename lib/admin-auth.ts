import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";

type AdminUserRecord = {
  id: string;
  auth_id: string | null;
  role: string | null;
  is_allowed: boolean | null;
  name: string | null;
  email: string | null;
};

/**
 * Verifies the current session belongs to an allowed admin.
 * Also recovers auth_id drift by matching trusted email when needed.
 */
export async function requireAuthorizedAdmin(): Promise<AdminUserRecord> {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/admin/login?error=unauthorized");
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const admin = createAdminClient();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, auth_id, role, is_allowed, name, email")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  let appUser = byAuthId;

  if (!appUser && normalizedEmail) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed, name, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (byEmail) {
      appUser = byEmail;

      if (byEmail.auth_id !== authUser.id) {
        await admin.from("users").update({ auth_id: authUser.id }).eq("id", byEmail.id);
      }
    }
  }

  const isAuthorizedAdmin =
    appUser?.role === "admin" && appUser.is_allowed !== false;

  if (!isAuthorizedAdmin || !appUser) {
    redirect("/admin/login?error=unauthorized");
  }

  return appUser;
}
