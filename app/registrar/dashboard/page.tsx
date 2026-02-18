import { createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RegistrarDashboardClient from "./registrar-dashboard-client";

export default async function RegistrarDashboard() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser || authUser.email !== "registraroffice@krmangalam.edu.in") {
    redirect("/registrar/login?error=unauthorized");
  }

  // You can add more registrar-specific logic here if needed

  return <RegistrarDashboardClient user={{
    name: authUser.user_metadata?.name || "Registrar",
    email: authUser.email,
    imageUrl: authUser.user_metadata?.imageUrl || undefined,
  }} />;
}
