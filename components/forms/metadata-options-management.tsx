"use client";

import { useEffect, useState } from "react";
import Button from "@/components/common/button";
import LoadingLinkButton from "@/components/common/loading-link-button";
import { buildFallbackAdminMetadataOptions } from "@/lib/document-metadata-defaults";
import type {
  AdminDocumentTypeOption,
  AdminMetadataOptions,
  AdminSchoolOption,
} from "@/types/document-metadata-options";

type AdminMetadataOptionsResponse = {
  options?: AdminMetadataOptions;
  source?: "database" | "fallback";
  error?: string;
};

const EMPTY_OPTIONS: AdminMetadataOptions = {
  documentTypes: [],
  schools: [],
  courses: [],
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Something went wrong";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeForValidation(value: string): string {
  return value.trim().toLowerCase();
}

export default function MetadataOptionsManagement() {
  const [options, setOptions] = useState<AdminMetadataOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [source, setSource] = useState<"database" | "fallback">("fallback");

  const loadOptions = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/metadata-options", {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({ error: "Failed to fetch metadata options" }))) as {
          error?: string;
        };

        throw new Error(payload.error || "Failed to fetch metadata options");
      }

      const payload = (await response.json()) as AdminMetadataOptionsResponse;
      const responseSource = payload.source ?? "fallback";
      const fallbackOptions = buildFallbackAdminMetadataOptions();

      const resolvedOptions =
        responseSource === "fallback"
          ? payload.options &&
            (payload.options.documentTypes.length > 0 ||
              payload.options.schools.length > 0 ||
              payload.options.courses.length > 0)
            ? payload.options
            : fallbackOptions
          : payload.options ?? EMPTY_OPTIONS;

      setOptions(resolvedOptions);
      setSource(responseSource);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  const updateDocumentType = (
    index: number,
    patch: Partial<AdminDocumentTypeOption>
  ) => {
    setOptions((current) => ({
      ...current,
      documentTypes: current.documentTypes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const updateSchool = (index: number, patch: Partial<AdminSchoolOption>) => {
    setOptions((current) => {
      const previous = current.schools[index];
      if (!previous) return current;

      const nextSchools = current.schools.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      );

      const nextSchoolKey = patch.key ?? previous.key;
      const nextCourses =
        nextSchoolKey !== previous.key
          ? current.courses.map((course) =>
              course.schoolKey === previous.key
                ? { ...course, schoolKey: nextSchoolKey }
                : course
            )
          : current.courses;

      return {
        ...current,
        schools: nextSchools,
        courses: nextCourses,
      };
    });
  };

  const addDocumentType = () => {
    setOptions((current) => ({
      ...current,
      documentTypes: [
        ...current.documentTypes,
        {
          key: "",
          label: "",
        },
      ],
    }));
  };

  const addSchool = () => {
    setOptions((current) => ({
      ...current,
      schools: [
        ...current.schools,
        {
          key: "",
          label: "",
        },
      ],
    }));
  };

  const removeDocumentType = (index: number) => {
    setOptions((current) => ({
      ...current,
      documentTypes: current.documentTypes.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const removeSchool = (index: number) => {
    setOptions((current) => {
      const schoolToRemove = current.schools[index];
      const nextSchools = current.schools.filter((_, itemIndex) => itemIndex !== index);

      if (!schoolToRemove) {
        return current;
      }

      return {
        ...current,
        schools: nextSchools,
        courses: current.courses.filter(
          (course) => course.schoolKey !== schoolToRemove.key
        ),
      };
    });
  };

  const validateOptions = (): string | null => {
    const hasBlankDocumentType = options.documentTypes.some(
      (item) => !item.key.trim() || !item.label.trim()
    );
    if (hasBlankDocumentType) {
      return "Every document type must have a key and label.";
    }

    const hasBlankSchool = options.schools.some(
      (item) => !item.key.trim() || !item.label.trim()
    );
    if (hasBlankSchool) {
      return "Every school must have a key and label.";
    }

    const normalizedDocumentTypeKeys = options.documentTypes.map((item) =>
      normalizeForValidation(item.key)
    );
    if (new Set(normalizedDocumentTypeKeys).size !== normalizedDocumentTypeKeys.length) {
      return "Document type keys must be unique.";
    }

    const normalizedSchoolKeys = options.schools.map((item) =>
      normalizeForValidation(item.key)
    );
    if (new Set(normalizedSchoolKeys).size !== normalizedSchoolKeys.length) {
      return "School keys must be unique.";
    }

    const schoolSet = new Set(options.schools.map((school) => school.key.trim()));
    const hasUnknownSchool = options.courses.some(
      (course) => !schoolSet.has(course.schoolKey.trim())
    );

    if (hasUnknownSchool) {
      return "Each course must point to an existing school key.";
    }

    return null;
  };

  const handleSave = async () => {
    if (saving) return;

    const validationError = validateOptions();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payloadToSave = options;

      const response = await fetch("/api/admin/metadata-options", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadToSave),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({ error: "Failed to save metadata options" }))) as {
          error?: string;
        };

        throw new Error(payload.error || "Failed to save metadata options");
      }

      const payload = (await response.json()) as AdminMetadataOptionsResponse;
      setOptions(payload.options ?? payloadToSave);
      setSource(payload.source ?? "database");
      setSuccess("Metadata options updated successfully.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading metadata options...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Source: {source === "database" ? "Database configuration" : "Fallback defaults"}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Document Types</h3>
          <Button type="button" size="sm" variant="outline" onClick={addDocumentType}>
            Add Document Type
          </Button>
        </div>

        <div className="space-y-2">
          {options.documentTypes.map((item, index) => (
            <div key={`doc-type-${index}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input
                type="text"
                value={item.key}
                onChange={(event) =>
                  updateDocumentType(index, { key: event.target.value })
                }
                onBlur={(event) => {
                  if (!event.target.value.trim() && item.label.trim()) {
                    updateDocumentType(index, { key: slugify(item.label) });
                  }
                }}
                placeholder="type_key"
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
              />
              <input
                type="text"
                value={item.label}
                onChange={(event) =>
                  updateDocumentType(index, { label: event.target.value })
                }
                onBlur={(event) => {
                  if (!item.key.trim() && event.target.value.trim()) {
                    updateDocumentType(index, { key: slugify(event.target.value) });
                  }
                }}
                placeholder="Label"
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => removeDocumentType(index)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Schools</h3>
          <Button type="button" size="sm" variant="outline" onClick={addSchool}>
            Add School
          </Button>
        </div>

        <div className="space-y-2">
          {options.schools.map((item, index) => (
            <div key={`school-${index}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input
                type="text"
                value={item.key}
                onChange={(event) => updateSchool(index, { key: event.target.value })}
                onBlur={(event) => {
                  if (!event.target.value.trim() && item.label.trim()) {
                    updateSchool(index, { key: slugify(item.label) });
                  }
                }}
                placeholder="school_key"
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
              />
              <input
                type="text"
                value={item.label}
                onChange={(event) => updateSchool(index, { label: event.target.value })}
                onBlur={(event) => {
                  if (!item.key.trim() && event.target.value.trim()) {
                    updateSchool(index, { key: slugify(event.target.value) });
                  }
                }}
                placeholder="Label"
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => removeSchool(index)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Courses</h3>
          <LoadingLinkButton
            href="/admin/registrars/courses"
            size="sm"
            variant="outline"
          >
            Open Courses Table
          </LoadingLinkButton>
        </div>

        <p className="text-sm text-gray-600">
          Manage courses in a dedicated searchable table view. You can add, edit, and delete courses there.
        </p>
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Total courses configured: {options.courses.length}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" isLoading={saving} onClick={handleSave}>
          Save Metadata Configuration
        </Button>
        <Button type="button" variant="outline" onClick={() => loadOptions()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
