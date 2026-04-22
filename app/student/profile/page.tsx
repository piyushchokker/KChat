import { redirect } from "next/navigation";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";
import StudentLayout from "@/components/layout/student-layout";

type StudentProfileRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roll_number: string | null;
  course: string | null;
  school: string | null;
  department: string | null;
  program: string | null;
  designation: string | null;
  image_url: string | null;
  is_allowed: boolean;
  created_at: string;
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

function toDateLabel(value: string | null | undefined): string {
  if (!value) return "Not available";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
        "id, name, email, role, roll_number, course, school, department, program, designation, image_url, is_allowed, created_at"
      )
      .eq("auth_id", authUser.id)
      .maybeSingle<StudentProfileRow>();

    profile = byAuthId;

    if (!profile && email) {
      const { data: byEmail } = await admin
        .from("users")
        .select(
          "id, name, email, role, roll_number, course, school, department, program, designation, image_url, is_allowed, created_at"
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
          "id, name, email, role, roll_number, course, school, department, program, designation, image_url, is_allowed, created_at"
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Name</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">{toDisplayValue(profileName)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Email</p>
              <p className="mt-1 break-all text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profileEmail)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Role</p>
              <p className="mt-1 text-sm font-medium capitalize text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.role ?? "student")}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Roll Number</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.roll_number ?? fallbackRollNumber)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Course</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.course ?? profile?.program)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">School</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.school)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Department</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.department)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Program</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.program)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Designation</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDisplayValue(profile?.designation)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Joined On</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">
                {toDateLabel(profile?.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
