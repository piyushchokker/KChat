import LoadingLinkButton from "@/components/common/loading-link-button";
import RegistrarManagement from "@/components/forms/registrar-management";
import MetadataOptionsManagement from "@/components/forms/metadata-options-management";
import { requireAuthorizedAdmin } from "@/lib/admin-auth";

export default async function AdminRegistrarsPage() {
  await requireAuthorizedAdmin();

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Registrar Portal Edit</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage registrar accounts and portal access settings.
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

        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Registrar Accounts</h2>
            <RegistrarManagement />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Registrar Upload Metadata Options
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Update schools, courses, document types, and semester rules used on the registrar upload page.
            </p>
            <MetadataOptionsManagement />
          </section>
        </div>
      </div>
    </main>
  );
}
