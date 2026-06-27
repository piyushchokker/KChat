import type { DocumentMetadata, UploadedDocument } from "@/types";
import { apiClient } from "./api-client";
const SHOULD_DEBUG_REGISTRAR_UPLOAD =
  process.env.NEXT_PUBLIC_DEBUG_REGISTRAR_UPLOAD === "true";

function logRegistrarUploadClientPayload(
  file: File,
  metadata: DocumentMetadata,
  metadataJson: string
) {
  const payloadPreview = {
    endpoint: "/api/documents/upload",
    method: "POST",
    file: {
      name: file.name,
      type: file.type || null,
      sizeBytes: file.size,
      lastModified: file.lastModified,
      lastModifiedIso:
        file.lastModified > 0 ? new Date(file.lastModified).toISOString() : null,
    },
    metadata,
    metadataJson,
  };

  console.log(
    "[Registrar Upload Debug] Client payload:\n" +
      JSON.stringify(payloadPreview, null, 2)
  );
}

/**
 * Upload a document with metadata to Supabase.
 */
export async function uploadDocument(
  file: File,
  metadata: DocumentMetadata
): Promise<UploadedDocument> {
  const formData = new FormData();
  const metadataJson = JSON.stringify(metadata);
  formData.append("file", file);
  formData.append("metadata", metadataJson);

  if (SHOULD_DEBUG_REGISTRAR_UPLOAD) {
    logRegistrarUploadClientPayload(file, metadata, metadataJson);
  }

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers: SHOULD_DEBUG_REGISTRAR_UPLOAD
      ? { "x-debug-registrar-upload": "1" }
      : undefined,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error ?? "Failed to upload document");
  }

  const data = await res.json();
  return {
    id: data.id,
    file: null,
    metadata: data.metadata,
    uploadedAt: new Date(data.uploadedAt),
    status: data.status,
  };
}

/**
 * Get all documents with optional filtering.
 */
export async function getDocuments(filters?: {
  type?: string;
  library?: string;
  school?: string;
  visibility?: string;
  status?: string;
  year?: string;
  q?: string;
  mine?: boolean;
  all?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ documents: UploadedDocument[]; pagination: { page: number; limit: number; total: number | null } }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.library) params.set("library", filters.library);
  if (filters?.school) params.set("school", filters.school);
  if (filters?.visibility) params.set("visibility", filters.visibility);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.year) params.set("year", filters.year);
  if (filters?.q) params.set("q", filters.q);
  if (filters?.mine !== undefined) params.set("mine", String(filters.mine));
  if (filters?.all !== undefined) params.set("all", String(filters.all));
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  return apiClient.get(`/documents/upload?${params.toString()}`);
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id: string) {
  return apiClient.get(`/documents/${id}`);
}

/**
 * Update a document's metadata.
 */
export async function updateDocument(
  id: string,
  updates: Partial<DocumentMetadata>
) {
  return apiClient.patch(`/documents/${id}`, updates);
}

/**
 * Delete a document.
 */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}
