"use client";

import { useRef, useState } from "react";
import MetadataFields from "./metadata-fields";
import Button from "@/components/common/button";
import { resolveMaxSemesters } from "@/lib/document-metadata-defaults";
import { useDocumentMetadataOptions } from "@/lib/use-document-metadata-options";
import type { FrontendMetadataOptions } from "@/types/document-metadata-options";
import useDocumentStore from "@/store/document-store";
import type { DocumentMetadata } from "@/types";

const KRMU_SCHOOL_ID = "10";

const DEFAULT_METADATA: DocumentMetadata = {
  title: "",
  documentType: "policy",
  fileName: undefined,
  fileSize: undefined,
  issuingAuthority: "",
  effectiveFrom: "",
  effectiveTill: "",
  school: null,
  course: null,
  semester: null,
  keywords: [],
};

function sanitizeMetadataForOptions(
  metadata: DocumentMetadata,
  options: FrontendMetadataOptions
): DocumentMetadata {
  const next: DocumentMetadata = { ...metadata };

  const documentTypeValues = options.documentTypes.map((item) => item.value);
  if (documentTypeValues.length > 0 && !documentTypeValues.includes(next.documentType)) {
    next.documentType = documentTypeValues[0];
  }

  const selectedSchool = next.school
    ? options.schools.find((school) => school.id === next.school)
    : null;

  if (next.school && !selectedSchool) {
    next.school = null;
    next.course = null;
    next.semester = null;
    return next;
  }

  const selectedCourse = next.course
    ? selectedSchool?.courses.find((course) => course.id === next.course)
    : null;

  if (next.course && !selectedCourse) {
    next.course = null;
    next.semester = null;
  }

  if (next.semester) {
    const activeCourse = next.course
      ? selectedSchool?.courses.find((course) => course.id === next.course)
      : null;

    if (!activeCourse) {
      next.semester = null;
    } else {
      const maxSemesters = resolveMaxSemesters(
        activeCourse.level,
        activeCourse.maxSemesters
      );
      const semesterAsNumber = Number.parseInt(next.semester, 10);

      if (
        !Number.isFinite(semesterAsNumber) ||
        semesterAsNumber < 1 ||
        (maxSemesters > 0 && semesterAsNumber > maxSemesters)
      ) {
        next.semester = null;
      }
    }
  }

  return next;
}

export default function DocumentUploadForm() {
  const { upload, isUploading } = useDocumentStore();
  const { options: metadataOptions } = useDocumentMetadataOptions();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata>(DEFAULT_METADATA);
  const [noExpiry, setNoExpiry] = useState(false);
  const [isKrmGeneralDocuments, setIsKrmGeneralDocuments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sanitizedMetadata = sanitizeMetadataForOptions(metadata, metadataOptions);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const effectiveFrom = noExpiry ? "NOEXPIRY" : sanitizedMetadata.effectiveFrom;
    const effectiveTill = noExpiry ? "NOEXPIRY" : sanitizedMetadata.effectiveTill;

    const effectiveSchool = isKrmGeneralDocuments
      ? KRMU_SCHOOL_ID
      : sanitizedMetadata.school ?? null;
    const effectiveCourse = isKrmGeneralDocuments ? null : sanitizedMetadata.course ?? null;
    const effectiveSemester = isKrmGeneralDocuments
      ? null
      : sanitizedMetadata.semester ?? null;

    const uploadMetadata: DocumentMetadata = {
      ...sanitizedMetadata,
      effectiveFrom,
      effectiveTill,
      school: effectiveSchool,
      course: effectiveCourse,
      semester: effectiveSemester,
      title:
        sanitizedMetadata.title && sanitizedMetadata.title.trim() !== ""
          ? sanitizedMetadata.title
          : file.name,
      fileName: file.name,
      fileSize: file.size,
    };
    await upload(file, uploadMetadata);
    // Reset form
    setFile(null);
    setMetadata(DEFAULT_METADATA);
    setNoExpiry(false);
    setIsKrmGeneralDocuments(false);
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
      <MetadataFields
        metadata={sanitizedMetadata}
        onChange={setMetadata}
        options={metadataOptions}
        noExpiry={noExpiry}
        onNoExpiryChange={setNoExpiry}
        isKrmGeneralDocuments={isKrmGeneralDocuments}
        onKrmGeneralDocumentsChange={(nextEnabled) => {
          setIsKrmGeneralDocuments(nextEnabled);
          if (nextEnabled) {
            setMetadata((prev) => ({
              ...prev,
              school: KRMU_SCHOOL_ID,
              course: null,
              semester: null,
            }));
          }
        }}
      />

      {/* Submit */}
      <Button
        type="submit"
        isLoading={isUploading}
        disabled={!file || !sanitizedMetadata.title}
        className="w-full"
        size="lg"
      >
        Upload Document
      </Button>
    </form>
  );
}
