import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import StudentLayout from "@/components/layout/student-layout";
import ChatContainer from "@/components/chatbot/chat-container";

export default async function StudentDashboard() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/student/login");
  }

  // Sync user to Supabase on every dashboard load
  const email = authUser.email ?? "";
  const meta = authUser.user_metadata ?? {};

  // Microsoft Azure: extract actual name (strip roll number from full_name)
  const rawName = meta.given_name || meta.name || meta.full_name || email;
  const name = rawName.replace(/\d+/g, "").trim();
  // Roll number = part before "@" in the email (e.g. 2501940081@krmu.edu.in)
  const rollNumber = email.includes("@") ? email.split("@")[0] : null;
  let imageUrl: string | undefined;
  let isBanned = false;

  try {
    const admin = createAdminClient();

    const { data, error: syncError } = await admin.from("users").upsert(
      {
        auth_id: authUser.id,
        email,
        name,
        role: "student",
        roll_number: rollNumber,
      },
      { onConflict: "roll_number" }
    ).select("image_url, is_allowed").single();

    if (syncError) {
      console.error("[Student Sync Error]", JSON.stringify(syncError, null, 2));
    } else {
      console.log("[Student Synced]", email);
    }

    if (data?.is_allowed === false) {
      isBanned = true;
    }

    imageUrl = data?.image_url ?? undefined;

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
        console.error("[Student Avatar Fetch]", imgErr);
      }
    }
  } catch (err) {
    console.error("[Student Sync Exception]", err instanceof Error ? err.message : String(err));
  }

  // Redirect banned students (must be outside try/catch because redirect() throws)
  if (isBanned) {
    redirect("/student/banned");
  }

  return (
    <StudentLayout
      user={{
        name: name || "Student",
        email,
        imageUrl,
      }}
    >
      <ChatContainer />
    </StudentLayout>
  );
}
