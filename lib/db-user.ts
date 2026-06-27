import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Resolves the application user record for a given auth user.
 * It first attempts to look up by auth_id. If that fails, it falls back
 * to looking up by email (case-insensitive). If an email match is found
 * without a matching auth_id, it updates the record to link them.
 */
export async function resolveAppUser(
  adminClient: SupabaseClient<Database>,
  authUser: { id: string; email?: string | null }
) {
  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();

  const { data: byAuthId } = await adminClient
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  let profile = byAuthId;

  if (!profile && normalizedEmail) {
    const { data: byEmail } = await adminClient
      .from("users")
      .select("*")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (byEmail) {
      profile = byEmail;

      if (byEmail.auth_id !== authUser.id) {
        await adminClient
          .from("users")
          .update({ auth_id: authUser.id })
          .eq("id", byEmail.id);
      }
    }
  }

  return profile;
}
