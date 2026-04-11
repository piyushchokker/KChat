"use client";

import { useCallback, useEffect, useState } from "react";
import { getDocuments, deleteDocument } from "@/services/document-service";
import type { UploadedDocument } from "@/types";
import Button from "@/components/common/button";
import { DOCUMENT_TYPES, SCHOOLS } from "@/utils/constants";
import LoadingLinkButton from "@/components/common/loading-link-button";

interface DocumentListProps {
  limit?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  showDelete?: boolean;
  mineOnly?: boolean;
  fetchAll?: boolean;
  showSeeAllButton?: boolean;
}

type UploadedByUser = {
  name?: string | null;
  email?: string | null;
};

type DocumentListItem = UploadedDocument & {
  title?: string;
  file_name?: string;
  document_type?: string;
  school?: string | null;
  created_at?: string;
  file_job_status?: string | null;
  uploaded_by_user?: UploadedByUser | UploadedByUser[] | null;
};

function getPipelineStatusGroup(status: string | null | undefined): {
  key: "processing" | "preparing" | "ready";
  label: string;
  className: string;
} {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "embedded") {
    return {
      key: "ready",
      label: "Ready",
      className: "bg-green-100 text-green-700",
    };
  }

  if (normalized === "chunked" || normalized === "summarised") {
    return {
      key: "preparing",
      label: "Preparing",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    key: "processing",
    label: "Processing",
    className: "bg-blue-100 text-blue-700",
  };
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}

export default function DocumentList({
  limit,
  showSearch = false,
  showFilters = false,
  showDelete = true,
  mineOnly = false,
  fetchAll = false,
  showSeeAllButton = false,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedStatusGroup, setSelectedStatusGroup] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getDocuments({
        limit,
        mine: mineOnly,
        all: fetchAll,
        type: selectedType || undefined,
        school: selectedSchool || undefined,
        q: searchTerm || undefined,
      });

      setDocuments(res.documents);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch documents"));
    } finally {
      setLoading(false);
    }
  }, [limit, mineOnly, fetchAll, selectedType, selectedSchool, searchTerm]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((docs) => docs.filter((doc) => doc.id !== id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to delete document"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading documents...</div>;

  const filteredDocuments = documents.filter((doc) => {
    if (!selectedStatusGroup) return true;
    return getPipelineStatusGroup(doc.file_job_status).key === selectedStatusGroup;
  });

  return (
    <div className="space-y-4">
      {(showSearch || showFilters) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {showSearch && (
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Search
                </label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by title or file name"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}

            {showFilters && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Document Type
                </label>
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All types</option>
                  {DOCUMENT_TYPES.map((docType) => (
                    <option key={docType.value} value={docType.value}>
                      {docType.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showFilters && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  School
                </label>
                <select
                  value={selectedSchool}
                  onChange={(event) => setSelectedSchool(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All schools</option>
                  {SCHOOLS.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showFilters && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Status
                </label>
                <select
                  value={selectedStatusGroup}
                  onChange={(event) => setSelectedStatusGroup(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All statuses</option>
                  <option value="processing">Processing (Blue)</option>
                  <option value="preparing">Preparing (Yellow)</option>
                  <option value="ready">Ready (Green)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-500">{error}</div>}

      {filteredDocuments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          No documents match the selected filters.
        </div>
      ) : (
        filteredDocuments.map((doc) => {
          const meta = doc.metadata || {};
          // Prefer top-level doc.title (from DB), fallback to metadata.title, else show placeholder
          const title = doc.title || meta.title || "(No title)";
          const documentType = doc.document_type || meta.documentType || "Unknown";
          const fileName = doc.file_name || "";
          const rawPipelineStatus = doc.file_job_status;
          const pipelineGroup = getPipelineStatusGroup(rawPipelineStatus);
          const uploadedByRaw = doc.uploaded_by_user;
          const uploadedBy = Array.isArray(uploadedByRaw)
            ? uploadedByRaw[0]
            : uploadedByRaw;

          let uploadedAt: Date;
          try {
            uploadedAt = doc.created_at
              ? new Date(doc.created_at)
              : doc.uploadedAt
              ? new Date(doc.uploadedAt)
              : new Date();
          } catch {
            uploadedAt = new Date();
          }

          return (
            <div key={doc.id} className="flex items-center justify-between rounded border p-4 bg-gray-50">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-gray-900">{title}</div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pipelineGroup.className}`}
                  >
                    {pipelineGroup.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {documentType} | Uploaded: {uploadedAt.toLocaleString()}
                </div>
                {rawPipelineStatus && (
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Stage: {rawPipelineStatus}
                  </div>
                )}
                {fileName && (
                  <div className="text-xs text-gray-500">File: {fileName}</div>
                )}
                {uploadedBy?.email && !mineOnly && (
                  <div className="text-xs text-gray-500">
                    Uploaded by: {uploadedBy.name || uploadedBy.email}
                  </div>
                )}
              </div>
              {showDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={deletingId === doc.id}
                  onClick={() => handleDelete(doc.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          );
        })
      )}

      {showSeeAllButton && (
        <div className="pt-1">
          <LoadingLinkButton
            href="/registrar/dashboard/uploaded-documents"
            variant="outline"
            className="h-10 border-2 border-blue-800 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            See All Uploaded Files
          </LoadingLinkButton>
        </div>
      )}
    </div>
  );
}
