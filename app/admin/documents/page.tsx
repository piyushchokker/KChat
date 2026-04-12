import LoadingLinkButton from "@/components/common/loading-link-button";
import DocumentList from "@/components/forms/document-list";
import { requireAuthorizedAdmin } from "@/lib/admin-auth";

export default async function AdminDocumentsPage() {
  await requireAuthorizedAdmin();

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Filter, inspect, and manage all uploaded documents.
            </p>
          </div>
          <LoadingLinkButton
            href="/admin/dashboard"
            variant="secondary"
            className="h-10 border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Admin Options
          </LoadingLinkButton>
        </div>

        <DocumentList
          fetchAll
          showSearch
          showFilters
          showDelete
          showSeeAllButton={false}
        />
      </div>
    </main>
  );
}
