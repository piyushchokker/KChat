import { createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import HomeClient from "@/components/home-client";

export default async function Home() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If already signed in, go straight to student chat
  if (user) {
    redirect("/student/chat");
  }

  return <HomeClient />;
}
