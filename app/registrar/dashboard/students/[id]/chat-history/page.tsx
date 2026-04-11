import Link from "next/link";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RegistrarLayout from "@/components/layout/registrar-layout";

interface StudentChatHistoryPageProps {
  params: Promise<{ id: string }>;
}

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  ret_session_id: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

const MAX_VISIBLE_CHATS = 5;

export default async function StudentChatHistoryPage(
  props: StudentChatHistoryPageProps
) {
  const { id: studentId } = await props.params;

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/registrar/login?error=unauthorized");
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const admin = createAdminClient();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, auth_id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  let registrarUser = byAuthId;

  if (!registrarUser && normalizedEmail) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (byEmail) {
      registrarUser = byEmail;

      if (byEmail.auth_id !== authUser.id) {
        await admin.from("users").update({ auth_id: authUser.id }).eq("id", byEmail.id);
      }
    }
  }

  const isAuthorizedRegistrar =
    registrarUser?.role === "registrar" && registrarUser.is_allowed !== false;

  if (!isAuthorizedRegistrar) {
    redirect("/registrar/login?error=unauthorized");
  }

  const { data: student } = await admin
    .from("users")
    .select("id, name, email, role, roll_number, program, department")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();

  if (!student) {
    redirect("/registrar/dashboard/students");
  }

  const { data: conversations } = await admin
    .from("conversations")
    .select("id, title, created_at, updated_at, ret_session_id")
    .eq("user_id", studentId)
    .order("updated_at", { ascending: false })
    .limit(MAX_VISIBLE_CHATS);

  const conversationRows = (conversations ?? []) as ConversationRow[];
  const conversationIds = conversationRows.map((row) => row.id);

  let messagesByConversation = new Map<string, MessageRow[]>();

  if (conversationIds.length > 0) {
    const { data: messages } = await admin
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });

    const grouped = new Map<string, MessageRow[]>();

    for (const message of (messages ?? []) as MessageRow[]) {
      const existing = grouped.get(message.conversation_id) ?? [];
      existing.push(message);
      grouped.set(message.conversation_id, existing);
    }

    messagesByConversation = grouped;
  }

  return (
    <RegistrarLayout
      user={{
        name: authUser.user_metadata?.name || "Registrar",
        email: authUser.email ?? normalizedEmail,
        imageUrl: authUser.user_metadata?.imageUrl || undefined,
      }}
    >
      <div className="flex-1 p-6 sm:p-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Student Chat History</h1>
              <p className="mt-1 text-sm text-gray-500">
                {student.name} · {student.email}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Roll: {student.roll_number || "-"} | Program: {student.program || "-"} | Department: {student.department || "-"}
              </p>
              <p className="mt-1 text-xs font-semibold text-blue-700">
                Showing only the last {MAX_VISIBLE_CHATS} chats
              </p>
            </div>
            <Link
              href="/registrar/dashboard/students"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back to Student Management
            </Link>
          </div>

          {conversationRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
              No chat history found for this student.
            </div>
          ) : (
            <div className="space-y-4">
              {conversationRows.map((conversation) => {
                const messages = messagesByConversation.get(conversation.id) ?? [];

                return (
                  <details
                    key={conversation.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {conversation.title || "Untitled Conversation"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Updated: {new Date(conversation.updated_at).toLocaleString()}
                          </p>
                          {conversation.ret_session_id && (
                            <p className="text-xs text-gray-500">
                              Session: {conversation.ret_session_id}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {messages.length} messages
                        </span>
                      </div>
                    </summary>

                    <div className="border-t border-gray-200 bg-white p-4">
                      {messages.length === 0 ? (
                        <p className="text-sm text-gray-500">No messages in this conversation.</p>
                      ) : (
                        <div className="space-y-3">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`rounded-lg px-3 py-2 text-sm ${
                                message.role === "user"
                                  ? "border border-blue-200 bg-blue-50"
                                  : "border border-gray-200 bg-gray-50"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                                <span className="font-semibold uppercase tracking-wide">
                                  {message.role}
                                </span>
                                <span>{new Date(message.created_at).toLocaleString()}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-gray-800">{message.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RegistrarLayout>
  );
}
