"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/common/button";

type RegistrarRecord = {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  
  created_at: string;
  updated_at: string;
  is_allowed: boolean;
};

type RegistrarEditForm = {
  name: string;
  email: string;
  department: string;
  
  is_allowed: boolean;
};

function toEditForm(registrar: RegistrarRecord): RegistrarEditForm {
  return {
    name: registrar.name ?? "",
    email: registrar.email ?? "",
    department: registrar.department ?? "",
    
    is_allowed: Boolean(registrar.is_allowed),
  };
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Something went wrong";
}

export default function RegistrarManagement() {
  const [registrars, setRegistrars] = useState<RegistrarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RegistrarEditForm | null>(null);

  const loadRegistrars = useCallback(async (withRefreshState = false) => {
    if (withRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const res = await fetch("/api/admin/registrars", { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res
          .json()
          .catch(() => ({ error: "Failed to load registrars" }))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to load registrars");
      }

      const payload = (await res.json()) as { registrars?: RegistrarRecord[] };
      setRegistrars(payload.registrars ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRegistrars();
  }, [loadRegistrars]);

  const filteredRegistrars = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return registrars;

    return registrars.filter((registrar) => {
      const haystack = [
        registrar.name,
        registrar.email,
        registrar.department ?? "",
        
        registrar.auth_id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [search, registrars]);

  const startEdit = (registrar: RegistrarRecord) => {
    setError("");
    setSuccess("");
    setEditingId(registrar.id);
    setForm(toEditForm(registrar));
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
      department: form.department.trim() || null,
      
      is_allowed: form.is_allowed,
    };

    try {
      const res = await fetch(`/api/admin/registrars/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errPayload = (await res
          .json()
          .catch(() => ({ error: "Failed to update registrar" }))) as {
          error?: string;
        };
        throw new Error(errPayload.error || "Failed to update registrar");
      }

      const updated = (await res.json()) as RegistrarRecord;

      setRegistrars((prev) =>
        prev.map((registrar) => (registrar.id === updated.id ? updated : registrar))
      );
      setSuccess("Registrar updated successfully.");
      setEditingId(null);
      setForm(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading registrars...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, or department"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={refreshing}
            onClick={() => loadRegistrars(true)}
            className="h-10"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}

      {filteredRegistrars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          No registrars found.
        </div>
      ) : (
        filteredRegistrars.map((registrar) => (
          <div key={registrar.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{registrar.name}</h3>
                <p className="text-sm text-gray-600">{registrar.email}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Department: {registrar.department || "-"} 
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    registrar.is_allowed
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {registrar.is_allowed ? "Allowed" : "Blocked"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(registrar)}
                >
                  Edit
                </Button>
              </div>
            </div>

            {editingId === registrar.id && form && (
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
                  Allow this registrar to access the portal
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
