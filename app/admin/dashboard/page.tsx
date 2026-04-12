import LoadingLinkButton from "@/components/common/loading-link-button";
import { requireAuthorizedAdmin } from "@/lib/admin-auth";

export default async function AdminDashboardPage() {
  const adminUser = await requireAuthorizedAdmin();
  const firstName = (adminUser.name ?? "Admin").trim().split(" ")[0] || "Admin";

  const options = [
    {
      key: "students",
      title: "Student Management Dashboard",
      description:
        "Review and edit student records, academic identifiers, and access permissions.",
      href: "/admin/students",
      cta: "Open Student Management",
    },
    {
      key: "registrars",
      title: "Registrar Portal Edit",
      description:
        "Manage registrar accounts, keep profile details updated, and control portal access.",
      href: "/admin/registrars",
      cta: "Open Registrar Portal Edit",
    },
    {
      key: "documents",
      title: "Document Management",
      description:
        "Monitor uploaded documents, filter by metadata, and remove outdated content.",
      href: "/admin/documents",
      cta: "Open Document Management",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
            Admin Control Center
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Welcome, {firstName}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose what you want to manage right now.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {options.map((option) => (
            <section
              key={option.key}
              className="flex h-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{option.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{option.description}</p>
              </div>

              <LoadingLinkButton
                href={option.href}
                className="mt-6 h-10 w-full"
              >
                {option.cta}
              </LoadingLinkButton>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
