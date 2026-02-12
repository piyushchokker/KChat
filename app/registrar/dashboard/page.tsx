import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RegistrarDashboardClient from "./registrar-dashboard-client";

export default async function RegistrarDashboard() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/registrar/login");
  }

  // Sync user to Supabase on every dashboard load
  const admin = createAdminClient();
  const email = authUser.email ?? "";
  const meta = authUser.user_metadata ?? {};

  // Microsoft Azure: extract actual name (strip roll number from full_name)
  const rawName = meta.given_name || meta.name || meta.full_name || email;
  const name = rawName.replace(/\d+/g, "").trim() || email;

  const { data, error: syncError } = await admin.from("users").upsert(
    {
      auth_id: authUser.id,
      email,
      name,
      role: "registrar",
    },
    { onConflict: "auth_id" }
  ).select("image_url").single();

  if (syncError) {
    console.error("[Registrar Sync Error]", syncError);
  } else {
    console.log("[Registrar Synced]", email);
  }

  return (
    <RegistrarDashboardClient
      user={{
        name: name || "Registrar",
        email,
        imageUrl: data?.image_url ?? undefined,
      }}
    />
  );
}
