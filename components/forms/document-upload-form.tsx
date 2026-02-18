"use client";

import { useState, useRef } from "react";
import MetadataFields from "./metadata-fields";
import Button from "@/components/common/button";
import useDocumentStore from "@/store/document-store";
import type { DocumentMetadata } from "@/types";

const DEFAULT_METADATA: DocumentMetadata = {
  title: "",
  documentType: "policy",
  libraryType: "general",
  keywords: [],
  issuingAuthority: "",
  effectiveFrom: "",
  effectiveTill: "",
};

export default function DocumentUploadForm() {
  const { upload, isUploading } = useDocumentStore();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata>(DEFAULT_METADATA);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    await upload(file, metadata);
    // Reset form
    setFile(null);
    setMetadata(DEFAULT_METADATA);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* File upload area */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Upload PDF Document
        </label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 transition-colors hover:border-blue-400 hover:bg-blue-50/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium text-blue-800">{file.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">
                Click to upload or drag and drop
              </p>
               <p className="mt-1 text-xs text-gray-400">Allowed: PDF, DOCX, TXT, MD, PPTX, XLSX, CSV, JSON, JSONL, HTML, XML, DOC (max 50MB)</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.pptx,.xlsx,.csv,.json,.jsonl,.html,.xml,.doc"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Metadata */}
      <MetadataFields metadata={metadata} onChange={setMetadata} />

      {/* Submit */}
      <Button
        type="submit"
        isLoading={isUploading}
        disabled={!file || !metadata.title}
        className="w-full"
        size="lg"
      >
        Upload Document
      </Button>
    </form>
  );
}
