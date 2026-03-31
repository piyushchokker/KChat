import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import StudentLayout from "@/components/layout/student-layout";

export default async function StudentBanned() {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/student/login");
  }

  const email = authUser.email ?? "";
  const meta = authUser.user_metadata ?? {};
  const rawName = meta.given_name || meta.name || meta.full_name || email;
  const name = rawName.replace(/\d+/g, "").trim();

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("is_allowed, image_url")
    .eq("auth_id", authUser.id)
    .single();

  // If user is actually allowed, send them back to chat
  if (data?.is_allowed !== false) {
    redirect("/student/chat");
  }

  return (
    <StudentLayout
      user={{
        name: name || "Student",
        email,
        imageUrl: data?.image_url ?? undefined,
      }}
    >
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-700">
            Access Revoked
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            You have violated the guidelines and have been{" "}
            <span className="font-semibold text-red-600">banned from KChat</span>.
          </p>
          <p className="mt-2 text-gray-600 leading-relaxed">
            Please contact the <span className="font-semibold">Dean&apos;s Office</span> for
            further assistance.
          </p>
          <div className="mt-8 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs text-gray-500">
              If you believe this is an error, visit the Dean&apos;s Office at{" "}
              <span className="font-medium text-gray-700">B-Block, 2nd Floor</span>{" "}
              or email{" "}
              <a href="mailto:dean.soet@krmangalam.edu.in" className="text-blue-600 underline">
                dean.soet@krmangalam.edu.in
              </a>
            </p>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
