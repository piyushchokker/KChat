"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/common/button";
import LoadingLinkButton from "@/components/common/loading-link-button";

type StudentRecord = {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  role: string;
  roll_number: string | null;
  department: string | null;
  
  program: string | null;
  created_at: string;
  updated_at: string;
  is_allowed: boolean;
};

type StudentEditForm = {
  name: string;
  email: string;
  roll_number: string;
  department: string;
  
  program: string;
  is_allowed: boolean;
};

function toEditForm(student: StudentRecord): StudentEditForm {
  return {
    name: student.name ?? "",
    email: student.email ?? "",
    roll_number: student.roll_number ?? "",
    department: student.department ?? "",
    
    program: student.program ?? "",
    is_allowed: Boolean(student.is_allowed),
  };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Something went wrong";
}

interface StudentManagementProps {
  apiBasePath?: string;
  chatHistoryBasePath?: string;
  showChatHistoryButton?: boolean;
}

export default function StudentManagement({
  apiBasePath = "/api/registrar/students",
  chatHistoryBasePath = "/registrar/dashboard/students",
  showChatHistoryButton = true,
}: StudentManagementProps) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentEditForm | null>(null);

  const loadStudents = useCallback(
    async (withRefreshState = false) => {
      if (withRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const res = await fetch(apiBasePath, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res
            .json()
            .catch(() => ({ error: "Failed to load students" }))) as {
            error?: string;
          };
          throw new Error(payload.error || "Failed to load students");
        }

        const payload = (await res.json()) as { students?: StudentRecord[] };
        setStudents(payload.students ?? []);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBasePath]
  );

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;

    return students.filter((student) => {
      const haystack = [
        student.name,
        student.email,
        student.roll_number ?? "",
        student.program ?? "",
        student.department ?? "",
        
        student.auth_id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [search, students]);

  const startEdit = (student: StudentRecord) => {
    setError("");
    setSuccess("");
    setEditingId(student.id);
    setForm(toEditForm(student));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !form || saving) return;

    const normalizedName = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();

    if (!normalizedName) {
      setError("Name is required");
      return;
    }

    if (!normalizedEmail) {
      setError("Email is required");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: normalizedName,
      email: normalizedEmail,
      roll_number: form.roll_number.trim() || null,
      department: form.department.trim() || null,
      
      program: form.program.trim() || null,
      is_allowed: form.is_allowed,
    };

    try {
      const res = await fetch(`${apiBasePath}/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errPayload = (await res
          .json()
          .catch(() => ({ error: "Failed to update student" }))) as {
          error?: string;
        };
        throw new Error(errPayload.error || "Failed to update student");
      }

      const updated = (await res.json()) as StudentRecord;

      setStudents((prev) =>
        prev.map((student) => (student.id === updated.id ? updated : student))
      );
      setSuccess("Student updated successfully.");
      setEditingId(null);
      setForm(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading students...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, roll number, program or department"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={refreshing}
            onClick={() => loadStudents(true)}
            className="h-10"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}

      {filteredStudents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          No students found.
        </div>
      ) : (
        filteredStudents.map((student) => (
          <div key={student.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{student.name}</h3>
                <p className="text-sm text-gray-600">{student.email}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Roll: {student.roll_number || "-"} | Program: {student.program || "-"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    student.is_allowed
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {student.is_allowed ? "Allowed" : "Blocked"}
                </span>
                {showChatHistoryButton && (
                  <LoadingLinkButton
                    href={`${chatHistoryBasePath}/${student.id}/chat-history`}
                    variant="secondary"
                    className="h-9 border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Open Student Chat History
                  </LoadingLinkButton>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(student)}
                >
                  Edit
                </Button>
              </div>
            </div>

            {editingId === student.id && form && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev ? { ...prev, name: event.target.value } : prev
                        )
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev ? { ...prev, email: event.target.value } : prev
                        )
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      value={form.roll_number}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev ? { ...prev, roll_number: event.target.value } : prev
                        )
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Program
                    </label>
                    <input
                      type="text"
                      value={form.program}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev ? { ...prev, program: event.target.value } : prev
                        )
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Department
                    </label>
                    <input
                      type="text"
                      value={form.department}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev ? { ...prev, department: event.target.value } : prev
                        )
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={form.designation}
                      onChange={(event) =>
                        setForm((prev) =>
                          prev ? { ...prev, designation: event.target.value } : prev
                        )
                      }
                      className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                </div>

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_allowed}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev ? { ...prev, is_allowed: event.target.checked } : prev
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Allow this student to access the portal
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    isLoading={saving}
                    onClick={saveEdit}
                  >
                    Save Changes
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
