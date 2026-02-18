import { useEffect, useState } from "react";
import { getDocuments, deleteDocument } from "@/services/document-service";
import type { UploadedDocument } from "@/types";
import Button from "@/components/common/button";

export default function DocumentList() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await getDocuments();
      setDocuments(res.documents);
    } catch (err: any) {
      setError(err.message || "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((docs) => docs.filter((doc) => doc.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div>Loading documents...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <div className="text-gray-500">No documents uploaded yet.</div>
      ) : (
        documents.map((doc) => {
          const meta = doc.metadata || {};
          const title = meta.title || "Untitled";
          const documentType = meta.documentType || "Unknown";
          let uploadedAt: Date;
          try {
            uploadedAt = doc.uploadedAt ? new Date(doc.uploadedAt) : new Date();
          } catch {
            uploadedAt = new Date();
          }
          return (
            <div key={doc.id} className="flex items-center justify-between rounded border p-4 bg-gray-50">
              <div>
                <div className="font-medium text-gray-900">{title}</div>
                <div className="text-xs text-gray-500">{documentType} | Uploaded: {uploadedAt.toLocaleString()}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={deletingId === doc.id}
                onClick={() => handleDelete(doc.id)}
              >
                Delete
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}
