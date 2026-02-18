"use client";

import { create } from "zustand";

import type { FileProcessingStatus, DocumentMetadata } from "@/types";
import { uploadDocument } from "@/services/document-service";

interface DocumentStoreState {
  processingFiles: FileProcessingStatus[];
  isUploading: boolean;
  error: string | null;
  uploadQueue: Array<{ file: File; metadata: DocumentMetadata }>;
  upload: (file: File, metadata: DocumentMetadata) => Promise<void>;
  processQueue: () => Promise<void>;
  clearProcessing: () => void;
}

const useDocumentStore = create<DocumentStoreState>((set, get) => ({
  processingFiles: [],
  isUploading: false,
  error: null,
  uploadQueue: [],

  upload: async (file, metadata) => {
    set((state) => ({
      uploadQueue: [...state.uploadQueue, { file, metadata }],
    }));
    await get().processQueue();
  },

  processQueue: async () => {
    if (get().isUploading) return;
    const next = get().uploadQueue[0];
    if (!next) return;
    set((state) => ({ isUploading: true }));
    const fileStatus: FileProcessingStatus = {
      id: `file-${Date.now()}`,
      fileName: next.file.name,
      status: "uploading",
      progress: 0,
    };
    set((state) => ({
      processingFiles: [...state.processingFiles, fileStatus],
      error: null,
    }));
    try {
      set((state) => ({
        processingFiles: state.processingFiles.map((f) =>
          f.id === fileStatus.id
            ? { ...f, status: "processing" as const, progress: 50 }
            : f
        ),
      }));
      await uploadDocument(next.file, next.metadata);
      set((state) => ({
        processingFiles: state.processingFiles.map((f) =>
          f.id === fileStatus.id
            ? { ...f, status: "completed" as const, progress: 100, message: "Document processed successfully" }
            : f
        ),
        isUploading: false,
        uploadQueue: state.uploadQueue.slice(1),
      }));
      // Process next in queue
      await get().processQueue();
    } catch (err) {
      set((state) => ({
        processingFiles: state.processingFiles.map((f) =>
          f.id === fileStatus.id
            ? {
                ...f,
                status: "failed" as const,
                progress: 0,
                message: err instanceof Error ? err.message : "Upload failed",
              }
            : f
        ),
        isUploading: false,
        error: err instanceof Error ? err.message : "Upload failed",
        uploadQueue: state.uploadQueue.slice(1),
      }));
      // Process next in queue
      await get().processQueue();
    }
  },

  clearProcessing: () => set({ processingFiles: [], error: null }),
}));

export default useDocumentStore;
