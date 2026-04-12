"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/common/button";
import { buildFallbackAdminMetadataOptions } from "@/lib/document-metadata-defaults";
import type {
  AdminCourseOption,
  AdminMetadataOptions,
  MetadataOptionLevel,
} from "@/types/document-metadata-options";

type AdminMetadataOptionsResponse = {
  options?: AdminMetadataOptions;
  source?: "database" | "fallback";
  error?: string;
};

const LEVEL_OPTIONS: MetadataOptionLevel[] = [
  "General",
  "Diploma",
  "UG",
  "PG",
  "Integrated",
  "PhD",
];

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

export default function CourseMetadataManagement() {
  const [options, setOptions] = useState<AdminMetadataOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

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
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  const updateCourse = (index: number, patch: Partial<AdminCourseOption>) => {
    setOptions((current) => ({
      ...current,
      courses: current.courses.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  };

  const addCourse = () => {
    const firstSchoolKey = options.schools[0]?.key ?? "";

    setOptions((current) => ({
      ...current,
      courses: [
        {
          schoolKey: firstSchoolKey,
          key: "",
          label: "",
          level: "UG",
          maxSemesters: 8,
        },
        ...current.courses,
      ],
    }));
  };

  const removeCourse = (index: number) => {
    setOptions((current) => ({
      ...current,
      courses: current.courses.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const validateOptions = (): string | null => {
    if (options.schools.length === 0) {
      return "Add at least one school before managing courses.";
    }

    const hasBlankCourse = options.courses.some(
      (item) =>
        !item.schoolKey.trim() ||
        !item.key.trim() ||
        !item.label.trim() ||
        item.maxSemesters < 0 ||
        item.maxSemesters > 20
    );

    if (hasBlankCourse) {
      return "Every course must have school, code, name, and max semesters between 0 and 20.";
    }

    const normalizedCourseKeys = options.courses.map((item) =>
      normalizeForValidation(item.key)
    );
    if (new Set(normalizedCourseKeys).size !== normalizedCourseKeys.length) {
      return "Course codes must be unique.";
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
      setSuccess("Course configuration saved successfully.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const schoolLabelByKey = useMemo(() => {
    return new Map(options.schools.map((school) => [school.key, school.label]));
  }, [options.schools]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return options.courses
      .map((course, index) => ({ course, index }))
      .filter(({ course }) => {
        if (!term) return true;

        const schoolLabel = schoolLabelByKey.get(course.schoolKey) ?? "";
        const haystack = [
          course.schoolKey,
          schoolLabel,
          course.key,
          course.label,
          course.level,
          String(course.maxSemesters),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      });
  }, [options.courses, schoolLabelByKey, search]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading courses...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by school, course code, course name, level"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCourse}>
            Add Course
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => loadOptions()}>
            Reload
          </Button>
          <Button type="button" size="sm" isLoading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-[960px] w-full text-left text-sm text-gray-700">
          <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Course Code</th>
              <th className="px-3 py-2">Course Name</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Max Semesters</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-sm text-gray-500">
                  No courses match your search.
                </td>
              </tr>
            ) : (
              filteredRows.map(({ course, index }) => (
                <tr key={`course-row-${index}`} className="border-t border-gray-200">
                  <td className="px-3 py-2 align-top">
                    <select
                      value={course.schoolKey}
                      onChange={(event) =>
                        updateCourse(index, { schoolKey: event.target.value })
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-2 text-sm text-gray-800"
                    >
                      <option value="">Select school</option>
                      {options.schools.map((school) => (
                        <option key={school.key} value={school.key}>
                          {school.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={course.key}
                      onChange={(event) =>
                        updateCourse(index, { key: event.target.value })
                      }
                      onBlur={(event) => {
                        if (!event.target.value.trim() && course.label.trim()) {
                          updateCourse(index, { key: slugify(course.label) });
                        }
                      }}
                      placeholder="course code"
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={course.label}
                      onChange={(event) =>
                        updateCourse(index, { label: event.target.value })
                      }
                      onBlur={(event) => {
                        if (!course.key.trim() && event.target.value.trim()) {
                          updateCourse(index, { key: slugify(event.target.value) });
                        }
                      }}
                      placeholder="Course Name"
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={course.level}
                      onChange={(event) =>
                        updateCourse(index, {
                          level: event.target.value as MetadataOptionLevel,
                        })
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-2 text-sm text-gray-800"
                    >
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={course.maxSemesters}
                      onChange={(event) =>
                        updateCourse(index, {
                          maxSemesters: Number.parseInt(event.target.value || "0", 10),
                        })
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeCourse(index)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
