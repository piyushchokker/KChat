"use client";

import { create } from "zustand";
import type { FileProcessingStatus, DocumentMetadata } from "@/types";
import { uploadDocument } from "@/services/document-service";

interface DocumentState {
  processingFiles: FileProcessingStatus[];
  isUploading: boolean;
  error: string | null;

  upload: (file: File, metadata: DocumentMetadata) => Promise<void>;
  clearProcessing: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  processingFiles: [],
  isUploading: false,
  error: null,

  upload: async (file, metadata) => {
    const fileStatus: FileProcessingStatus = {
      id: `file-${Date.now()}`,
      fileName: file.name,
      status: "uploading",
      progress: 0,
    };

    set((state) => ({
      processingFiles: [...state.processingFiles, fileStatus],
      isUploading: true,
      error: null,
    }));

    try {
      // Simulate progress
      set((state) => ({
        processingFiles: state.processingFiles.map((f) =>
          f.id === fileStatus.id
            ? { ...f, status: "processing" as const, progress: 50 }
            : f
        ),
      }));

      await uploadDocument(file, metadata);

      set((state) => ({
        processingFiles: state.processingFiles.map((f) =>
          f.id === fileStatus.id
            ? { ...f, status: "completed" as const, progress: 100, message: "Document processed successfully" }
            : f
        ),
        isUploading: false,
      }));
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
      }));
    }
  },

  clearProcessing: () => set({ processingFiles: [], error: null }),
}));
