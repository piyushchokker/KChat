import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { resolveAppUser } from "@/lib/db-user";

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

  const admin = createAdminClient();
  const appUser = await resolveAppUser(admin, authUser);

  const isAuthorizedAdmin =
    appUser?.role === "admin" && appUser.is_allowed !== false;

  if (!isAuthorizedAdmin || !appUser) {
    redirect("/admin/login?error=unauthorized");
  }

  return appUser as AdminUserRecord;
}
