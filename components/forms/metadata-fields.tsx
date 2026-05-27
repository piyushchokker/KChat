"use client";

import SelectDropdown from "@/components/common/select-dropdown";
import InputField from "@/components/common/input-field";
import DatePicker from "@/components/common/date-picker";
import { resolveMaxSemesters } from "@/lib/document-metadata-defaults";
import type { FrontendMetadataOptions } from "@/types/document-metadata-options";
import type { DocumentMetadata } from "@/types";

interface MetadataFieldsProps {
  metadata: DocumentMetadata;
  onChange: (metadata: DocumentMetadata) => void;
  options: FrontendMetadataOptions;
  noExpiry?: boolean;
  onNoExpiryChange?: (value: boolean) => void;
  isKrmGeneralDocuments?: boolean;
  onKrmGeneralDocumentsChange?: (value: boolean) => void;
}

export default function MetadataFields({
  metadata,
  onChange,
  options,
  noExpiry = false,
  onNoExpiryChange,
  isKrmGeneralDocuments = false,
  onKrmGeneralDocumentsChange,
}: MetadataFieldsProps) {
  const NO_EXPIRY_VALUE = "NOEXPIRY";
  const KRMU_SCHOOL_ID = "10";
  const selectedSchool = metadata.school ?? "";
  const school = options.schools.find((item) => item.id === selectedSchool);
  const courses = school?.courses ?? [];
  const selectedCourse = courses.find((course) => course.id === metadata.course);
  const maxSemesters = selectedCourse
    ? resolveMaxSemesters(selectedCourse.level, selectedCourse.maxSemesters)
    : 0;

  const semesterOptions = (() => {
    if (!selectedSchool || !metadata.course || maxSemesters <= 0) return [];

    return Array.from({ length: maxSemesters }, (_, i) => ({
      value: String(i + 1),
      label: `${i + 1}${["st", "nd", "rd"][i] || "th"} Semester`,
    }));
  })();

  const update = (partial: Partial<DocumentMetadata>) => {
    onChange({ ...metadata, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* KRMU general documents toggle */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={isKrmGeneralDocuments}
            onChange={(e) => {
              const checked = e.target.checked;
              onKrmGeneralDocumentsChange?.(checked);
              if (checked) {
                update({ school: KRMU_SCHOOL_ID, course: null, semester: null });
              }
            }}
          />
          KRMU general documents
        </label>
      </div>

      {/* School */}
      {!isKrmGeneralDocuments && (
        <SelectDropdown
          label="Select School"
          required
          options={options.schools.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          placeholder="-- Select School --"
          value={selectedSchool}
          onChange={(e) => {
            const newSchoolId = e.target.value;
            const nextSchool = options.schools.find((item) => item.id === newSchoolId);
            const autoSelectedCourse =
              nextSchool && nextSchool.courses.length === 1
                ? nextSchool.courses[0].id
                : null;

            onKrmGeneralDocumentsChange?.(false);
            update({ school: newSchoolId || null, course: autoSelectedCourse, semester: null });
          }}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      )}

      {/* Course */}
      {!isKrmGeneralDocuments && (
        <SelectDropdown
          label="Select Course"
          required={courses.length > 0}
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
          placeholder={
            !selectedSchool
              ? "-- Select School First --"
              : courses.length > 0
                ? "-- Select Course --"
                : "-- No Courses Available --"
          }
          value={metadata.course ?? ""}
          onChange={(e) => {
            onKrmGeneralDocumentsChange?.(false);
            update({ course: e.target.value || null, semester: null });
          }}
          disabled={!selectedSchool || courses.length === 0}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />
      )}

      {/* Document Title */}
      <InputField
        label="Document Title"
        required
        placeholder="e.g., Fee Structure 2024, Admission Guidelines, etc."
        value={metadata.title}
        onChange={(e) => update({ title: e.target.value })}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

      {/* Document Type */}
      <SelectDropdown
        label="Document's Department"
        required
        options={options.documentTypes}
        placeholder="-- Select Type --"
        value={metadata.documentType}
        onChange={(e) => update({ documentType: e.target.value })}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />

      {/* Semester (course-specific only) */}
      {selectedSchool && !isKrmGeneralDocuments && semesterOptions.length > 0 && (
        <SelectDropdown
          label="Semester"
          required
          options={semesterOptions}
          placeholder="-- Select Semester --"
          value={metadata.semester || ""}
          onChange={e => update({ semester: e.target.value })}
        />
      )}

      {/* Removed Directions and Professor Details fields (now only in dropdown) */}

      {/* Effective Dates */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={noExpiry}
            onChange={(e) => {
              const checked = e.target.checked;
              onNoExpiryChange?.(checked);
              update({
                effectiveFrom: checked ? NO_EXPIRY_VALUE : "",
                effectiveTill: checked ? NO_EXPIRY_VALUE : "",
              });
            }}
          />
          This document does not need validity and is always valid
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DatePicker
          label="Effective From"
          placeholder={noExpiry ? "NOEXPIRY" : "Start date"}
          value={noExpiry ? "" : metadata.effectiveFrom}
          onChange={(value) => {
            if (noExpiry) return;
            update({ effectiveFrom: value });
          }}
          footer={true}
          disabled={noExpiry}
        />
        <DatePicker
          label="Effective Till"
          placeholder={noExpiry ? "NOEXPIRY" : "End date"}
          value={noExpiry ? "" : metadata.effectiveTill}
          onChange={(value) => {
            if (noExpiry) return;
            update({ effectiveTill: value });
          }}
          footer={true}
          disabled={noExpiry}
        />
      </div>

      {/* Visibility */}
        {/* Removed Visibility Field */}

      {/* Removed Allow AI Usage Field */}

      {/* Issuing Authority */}
      <InputField
        label="Issuing Authority"
        placeholder="e.g., Office of the Registrar"
        value={metadata.issuingAuthority}
        onChange={(e) => update({ issuingAuthority: e.target.value })}
      />

    </div>
  );
}
