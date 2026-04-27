"use client";

import RegistrarLayout from "@/components/layout/registrar-layout";
import DocumentUploadForm from "@/components/forms/document-upload-form";
import DocumentList from "@/components/forms/document-list";
import useDocumentStore from "@/store/document-store";
import LoadingLinkButton from "@/components/common/loading-link-button";

interface RegistrarDashboardClientProps {
  user: {
    name: string;
    email: string;
    imageUrl?: string;
  };
}

export default function RegistrarDashboardClient({
  user,
}: RegistrarDashboardClientProps) {
  const { processingFiles } = useDocumentStore();

  return (
    <RegistrarLayout user={user}>
      <div className="flex-1 p-6 sm:p-8">
        <div className="mx-auto mb-4 flex max-w-6xl justify-end gap-2">
          <LoadingLinkButton
            href="/registrar/dashboard/students"
            variant="secondary"
            className="h-10 border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Manage Students
          </LoadingLinkButton>
          <LoadingLinkButton
            href="/registrar/raised-queries"
            variant="secondary"
            className="h-10 border border-blue-800 bg-white px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            Raised Queries
          </LoadingLinkButton>
        </div>
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          {/* Left panel – Upload */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Upload Document
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload PDF documents with metadata for the RAG chatbot system
              </p>
            </div>
            <DocumentUploadForm />
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">Uploaded Documents</h3>
              <p className="mb-3 text-sm text-gray-500">Showing 5 most recent uploads</p>
              <DocumentList
                limit={5}
                mineOnly
                showDelete={false}
                showSeeAllButton
              />
            </div>
          </div>

          {/* Right panel – Processing Status */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                <svg
                  className="h-5 w-5 text-blue-800"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                File Processing Status
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Real-time status of document processing
              </p>
            </div>

            {processingFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg
                  className="mb-4 h-16 w-16 text-gray-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm text-gray-400">
                  No files being processed
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {processingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {file.fileName}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          file.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : file.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : file.status === "processing"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {file.status}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          file.status === "completed"
                            ? "bg-green-500"
                            : file.status === "failed"
                            ? "bg-red-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    {file.message && (
                      <p className="mt-1.5 text-xs text-gray-500">
                        {file.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </RegistrarLayout>
  );
}
