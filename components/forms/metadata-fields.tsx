"use client";

import { useState } from "react";
import SelectDropdown from "@/components/common/select-dropdown";
import InputField from "@/components/common/input-field";
import DatePicker from "@/components/common/date-picker";
import { SCHOOLS, DOCUMENT_TYPES } from "@/utils/constants";
import type { DocumentMetadata, LibraryType } from "@/types";

interface MetadataFieldsProps {
  metadata: DocumentMetadata;
  onChange: (metadata: DocumentMetadata) => void;
}

export default function MetadataFields({
  metadata,
  onChange,
}: MetadataFieldsProps) {
  const [selectedSchool, setSelectedSchool] = useState("");

  const school = SCHOOLS.find((s) => s.id === selectedSchool);
  const courses = school?.courses ?? [];

  const update = (partial: Partial<DocumentMetadata>) => {
    onChange({ ...metadata, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* School */}
      <SelectDropdown
        label="Select School"
        required
        options={SCHOOLS.map((s) => ({ value: s.id, label: s.name }))}
        placeholder="-- Select School --"
        value={selectedSchool}
        onChange={(e) => {
          const newSchoolId = e.target.value;
          setSelectedSchool(newSchoolId);
          // If KRMU base docs selected, auto-select general and lock the course
          if (newSchoolId === "base") {
            update({ school: newSchoolId, course: "general" });
          } else {
            update({ school: newSchoolId, course: "" });
          }
        }}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
      />

      {/* Course */}
      <SelectDropdown
        label="Select Course"
        required
        options={courses.map((c) => ({ value: c.id, label: c.name }))}
        placeholder={
          selectedSchool === "base"
            ? "-- General University Circulars --"
            : selectedSchool
            ? "-- Select Course --"
            : "-- Select School First --"
        }
        value={metadata.course ?? ""}
        onChange={(e) => update({ course: e.target.value })}
        disabled={!selectedSchool || selectedSchool === "base"}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
      />

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
        label="Document Type"
        required
        options={DOCUMENT_TYPES}
        placeholder="-- Select Type --"
        value={metadata.documentType}
        onChange={(e) =>
          update({ documentType: e.target.value as DocumentMetadata["documentType"] })
        }
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />

      {/* Effective Dates */}
      <div className="grid grid-cols-2 gap-4">
        <DatePicker
          label="Effective From"
          placeholder="Start date"
          value={metadata.effectiveFrom}
          onChange={(value) => update({ effectiveFrom: value })}
          footer={true}
        />
        <DatePicker
          label="Effective Till"
          placeholder="End date"
          value={metadata.effectiveTill}
          onChange={(value) => update({ effectiveTill: value })}
          footer={true}
        />
      </div>

      {/* Visibility */}
      <SelectDropdown
        label="Visibility"
        required
        options={[
          { value: "public", label: "Public" },
          { value: "internal", label: "Internal" },
          { value: "archived", label: "Archived" },
        ]}
        value={metadata.visibility}
        onChange={(e) =>
          update({ visibility: e.target.value as DocumentMetadata["visibility"] })
        }
      />

      {/* Allow AI Usage */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-gray-700">
          Allow AI Usage
        </label>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={metadata.allowAiUsage}
            onChange={(e) => update({ allowAiUsage: e.target.checked })}
            className="peer sr-only"
          />
          <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300" />
        </label>
        <span className="text-sm text-gray-500">
          {metadata.allowAiUsage ? "Yes" : "No"}
        </span>
      </div>

      {/* Keywords */}
      <InputField
        label="Keywords / Tags"
        placeholder="e.g., fees, admission, transcript (comma-separated)"
        value={metadata.keywords.join(", ")}
        onChange={(e) =>
          update({
            keywords: e.target.value
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
          })
        }
      />

      {/* Issuing Authority */}
      <InputField
        label="Issuing Authority"
        placeholder="e.g., Office of the Registrar"
        value={metadata.issuingAuthority}
        onChange={(e) => update({ issuingAuthority: e.target.value })}
      />

      {/* Version */}
      <InputField
        label="Version"
        placeholder="e.g., v1.0"
        value={metadata.version}
        onChange={(e) => update({ version: e.target.value })}
      />
    </div>
  );
}
