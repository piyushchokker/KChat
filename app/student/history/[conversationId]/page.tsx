import { redirect } from "next/navigation";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";
import StudentLayout from "@/components/layout/student-layout";
import ChatContainer from "@/components/chatbot/chat-container";

interface StudentHistoryPageProps {
  params: Promise<{ conversationId: string }>;
}

interface StudentUserRow {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
  is_allowed: boolean;
}

function normalizeName(email: string, metadata: Record<string, unknown>): string {
  const raw =
    (typeof metadata.given_name === "string" && metadata.given_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    email;

  const cleaned = raw.replace(/\d+/g, "").trim();
  return cleaned.length > 0 ? cleaned : "Student";
}

export default async function StudentHistoryPage(props: StudentHistoryPageProps) {
  const { conversationId } = await props.params;

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/student/login?error=auth_failed");
  }

  const access = await verifyStudentAccess(authUser);

  if (!access.ok) {
    if (access.reason === "not_allowed") {
      redirect("/student/banned");
    }

    redirect("/student/login?error=auth_failed");
  }

  const email = (authUser.email ?? "").trim().toLowerCase();
  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackName = normalizeName(email, metadata);

  const admin = createAdminClient();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, name, email, image_url, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle<StudentUserRow>();

  let studentUser = byAuthId;

  if (!studentUser && email) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, name, email, image_url, is_allowed")
      .ilike("email", email)
      .maybeSingle<StudentUserRow>();

    studentUser = byEmail;
  }

  if (studentUser?.is_allowed === false) {
    redirect("/student/banned");
  }

  if (!studentUser) {
    const { data: inserted } = await admin
      .from("users")
      .insert({
        auth_id: authUser.id,
        email,
        name: fallbackName,
        role: "student",
        is_allowed: true,
      })
      .select("id, name, email, image_url, is_allowed")
      .single<StudentUserRow>();

    studentUser = inserted;
  }

  if (!studentUser) {
    redirect("/student/login?error=auth_failed");
  }

  const { data: conversation } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", studentUser.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!conversation) {
    redirect("/student/chat");
  }

  return (
    <StudentLayout
      user={{
        name: studentUser.name || fallbackName,
        email: studentUser.email || email,
        imageUrl: studentUser.image_url ?? undefined,
      }}
    >
      <ChatContainer
        historyConversationId={conversationId}
        isReadOnlyHistory
      />
    </StudentLayout>
  );
}
