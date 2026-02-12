import type { DocumentMetadata, UploadedDocument } from "@/types";

/**
 * Upload a document with metadata to Supabase.
 */
export async function uploadDocument(
  file: File,
  metadata: DocumentMetadata
): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(metadata));

  const res = await fetch("/api/documents/upload", {
    method: "POST",
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
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  const res = await fetch(`/api/documents/upload?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id: string) {
  const res = await fetch(`/api/documents/${id}`);
  if (!res.ok) {
    throw new Error("Document not found");
  }
  return res.json();
}

/**
 * Update a document's metadata.
 */
export async function updateDocument(
  id: string,
  updates: Partial<DocumentMetadata>
) {
  const res = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? "Failed to update document");
  }

  return res.json();
}

/**
 * Delete a document.
 */
export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error ?? "Failed to delete document");
  }
}

