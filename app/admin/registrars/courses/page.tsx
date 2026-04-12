import LoadingLinkButton from "@/components/common/loading-link-button";
import CourseMetadataManagement from "@/components/forms/course-metadata-management";
import { requireAuthorizedAdmin } from "@/lib/admin-auth";

export default async function AdminRegistrarCoursesPage() {
  await requireAuthorizedAdmin();

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Course Metadata Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Search, edit, add, and delete courses in tabular format.
            </p>
          </div>
          <LoadingLinkButton
            href="/admin/registrars"
            variant="secondary"
            className="h-10 border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Registrar Portal Edit
          </LoadingLinkButton>
        </div>

        <CourseMetadataManagement />
      </div>
    </main>
  );
}
