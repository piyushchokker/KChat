import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function AdminDashboardPage() {
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
    .select("id, auth_id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  let appUser = byAuthId;

  // If auth_id drifted (e.g., account recreated), recover via trusted email match.
  if (!appUser && normalizedEmail) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (byEmail) {
      appUser = byEmail;

      if (byEmail.auth_id !== authUser.id) {
        await admin
          .from("users")
          .update({ auth_id: authUser.id })
          .eq("id", byEmail.id);
      }
    }
  }

  const isAuthorizedAdmin =
    appUser?.role === "admin" && appUser.is_allowed !== false;

  if (!isAuthorizedAdmin) {
    redirect("/admin/login?error=unauthorized");
  }

  return <main className="min-h-screen" />;
}
