import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RegistrarDashboardClient from "./registrar-dashboard-client";

export default async function RegistrarDashboard() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/registrar/login");
  }

  // Create admin client before use
  const admin = createAdminClient();

  // Securely check if the email is in registrar_authentication table
  const { data: registrarAuth, error: registrarAuthError } = await admin
    .from("registrar_authentication")
    .select("email")
    .eq("email", authUser.email)
    .single();

  if (registrarAuthError || !registrarAuth) {
    redirect("/registrar/login?error=unauthorized");
  }

  // Sync user to Supabase on every dashboard load
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

  let imageUrl = data?.image_url ?? undefined;

  // If no image stored yet, try fetching from Microsoft Graph
  if (!imageUrl) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;
      if (providerToken) {
        const photoRes = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: { Authorization: `Bearer ${providerToken}` },
        });
        if (photoRes.ok) {
          const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
          const contentType = photoRes.headers.get("content-type") || "image/jpeg";
          const ext = contentType.includes("png") ? "png" : "jpg";
          const storagePath = `${authUser.id}.${ext}`;
          await admin.storage.from("avatars").upload(storagePath, photoBuffer, { contentType, upsert: true });
          const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(storagePath);
          imageUrl = `${publicUrl}?t=${Date.now()}`;
          await admin.from("users").update({ image_url: imageUrl }).eq("auth_id", authUser.id);
        }
      }
    } catch (imgErr) {
      console.error("[Registrar Avatar Fetch]", imgErr);
    }
  }

  return (
    <RegistrarDashboardClient
      user={{
        name: name || "Registrar",
        email,
        imageUrl,
      }}
    />
  );
}
