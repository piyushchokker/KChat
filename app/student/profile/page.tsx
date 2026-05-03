import { redirect } from "next/navigation";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";
import StudentLayout from "@/components/layout/student-layout";

type StudentProfileRow = {
  id: string;
  name: string;
  email: string;
  roll_number: string | null;
  course: string | null;
  school: string | null;
  program: string | null;
  image_url: string | null;
  is_allowed: boolean;
};

function resolveStudentName(email: string, metadata: Record<string, unknown>): string {
  const raw =
    (typeof metadata.given_name === "string" && metadata.given_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    email;

  const cleaned = raw.replace(/\d+/g, "").trim();
  return cleaned.length > 0 ? cleaned : "Student";
}

function toDisplayValue(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "Not available";
}

export default async function StudentProfilePage() {
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

    // Permit rendering with fallback profile details when lookup fails transiently.
    if (access.reason !== "lookup_failed") {
      redirect("/student/login?error=auth_failed");
    }
  }

  const email = (authUser.email ?? "").trim().toLowerCase();
  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackName = resolveStudentName(email, metadata);
  const fallbackRollNumber = email.includes("@") ? email.split("@")[0] : null;

  let profile: StudentProfileRow | null = null;

  try {
    const admin = createAdminClient();

    const { data: byAuthId } = await admin
      .from("users")
      .select(
        "id, name, email, roll_number, course, school, program, image_url, is_allowed"
      )
      .eq("auth_id", authUser.id)
      .maybeSingle<StudentProfileRow>();

    profile = byAuthId;

    if (!profile && email) {
      const { data: byEmail } = await admin
        .from("users")
        .select(
          "id, name, email, roll_number, course, school, program, image_url, is_allowed"
        )
        .ilike("email", email)
        .maybeSingle<StudentProfileRow>();

      profile = byEmail;
    }

    if (profile?.is_allowed === false) {
      redirect("/student/banned");
    }

    if (!profile) {
      const { data: inserted } = await admin
        .from("users")
        .insert({
          auth_id: authUser.id,
          email,
          name: fallbackName,
          role: "student",
          is_allowed: true,
          roll_number: fallbackRollNumber,
        })
        .select(
          "id, name, email, roll_number, course, school, program, image_url, is_allowed"
        )
        .single<StudentProfileRow>();

      profile = inserted;
    }
  } catch (err) {
    console.error(
      "[Student Profile Load Error]",
      err instanceof Error ? err.message : String(err)
    );
  }

  const profileName = profile?.name?.trim() || fallbackName;
  const profileEmail = profile?.email?.trim() || email;
  const profileImageUrl = profile?.image_url ?? undefined;

  return (
    <StudentLayout
      user={{
        name: profileName,
        email: profileEmail,
        imageUrl: profileImageUrl,
      }}
    >
      <div className="flex flex-1 justify-center overflow-y-auto px-4 py-6 sm:px-8">
        <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">My Profile</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            Your basic information associated with your student account.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
            <div className="border-b border-blue-100/80 px-5 py-4 dark:border-zinc-700">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                Student Account
              </p>
              <p className="mt-1 text-base font-semibold text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profileName)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 p-3 sm:p-4">
              <div className="grid items-start gap-2 rounded-xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Name</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{toDisplayValue(profileName)}</p>
              </div>
              <div className="grid items-start gap-2 rounded-xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Roll Number</p>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {toDisplayValue(profile?.roll_number ?? fallbackRollNumber)}
                </p>
              </div>
              <div className="grid items-start gap-2 rounded-xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Email</p>
                <p className="break-all text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {toDisplayValue(profileEmail)}
                </p>
              </div>
              <div className="grid items-start gap-2 rounded-xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Course</p>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {toDisplayValue(profile?.course ?? profile?.program)}
                </p>
              </div>
              <div className="grid items-start gap-2 rounded-xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">School</p>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {toDisplayValue(profile?.school)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
