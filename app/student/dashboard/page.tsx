import { redirect } from "next/navigation";

export default function StudentDashboardBootstrapRedirect() {
  redirect("/student/chat");
}
