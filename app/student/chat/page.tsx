import { createServerClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";
import { redirect } from "next/navigation";

export default async function StudentChatBootstrap() {
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

  redirect("/api/chat/session/init");
}