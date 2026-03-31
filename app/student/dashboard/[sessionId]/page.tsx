import { redirect } from "next/navigation";

interface LegacyStudentDashboardSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

function normalizeSessionId(input: string): string {
  return input.trim().toLowerCase();
}

export default async function LegacyStudentDashboardSessionPage(
  props: LegacyStudentDashboardSessionPageProps
) {
  const { sessionId } = await props.params;
  const normalizedSessionId = normalizeSessionId(sessionId);
  redirect(`/student/chat/${encodeURIComponent(normalizedSessionId)}`);
}
