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
      { onConflict: "auth_id" }
    ).select("image_url").single();

    if (syncError) {
      console.error("[Student Sync Error]", JSON.stringify(syncError, null, 2));
    } else {
      console.log("[Student Synced]", email);
    }

    imageUrl = data?.image_url ?? undefined;
  } catch (err) {
    console.error("[Student Sync Exception]", err instanceof Error ? err.message : String(err));
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
