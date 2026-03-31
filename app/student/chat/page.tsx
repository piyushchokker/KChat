import { createServerClient } from "@/lib/supabase-server";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

export default async function StudentChatBootstrap() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/student/login");
  }

  const sessionId = randomUUID();
  redirect(`/student/chat/${sessionId}`);
}