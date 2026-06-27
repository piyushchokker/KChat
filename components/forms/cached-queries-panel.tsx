"use client";

import { useMemo, useState } from "react";

type CachedQueryUser = {
  name: string | null;
  email: string | null;
} | null;

export type CachedQueryRow = {
  id: string;
  query: string;
  answer: string | null;
  created_at: string;
  
  
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

type CsvRow = { query: string; answer: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // ignore trailing empty row
    if (row.length === 1 && row[0] === "" && rows.length === 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (char === "\r") {
      // ignore CR (handles CRLF)
      continue;
    }

    field += char;
  }

  pushField();
  if (row.some((cell) => cell.trim() !== "")) {
    pushRow();
  }

  return rows;
}

function parseQueryAnswerCsv(text: string): CsvRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const queryIndex = header.indexOf("query");
  const answerIndex = header.indexOf("answer");

  if (queryIndex === -1 || answerIndex === -1) {
    throw new Error('CSV must have headers "query" and "answer".');
  }

  const rows: CsvRow[] = [];
  for (const line of table.slice(1)) {
    const query = (line[queryIndex] ?? "").trim();
    const answer = (line[answerIndex] ?? "").trim();
    if (!query && !answer) continue;
    rows.push({ query, answer });
  }

  return rows;
}

export default function CachedQueriesPanel({
  initialQueries,
}: {
  initialQueries: CachedQueryRow[];
}) {
  const [filter, setFilter] = useState("");
  const [queries, setQueries] = useState<CachedQueryRow[]>(() => initialQueries);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newQuery, setNewQuery] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return queries;

    return queries.filter((row) => {
      const haystack =
        `${row.query} ${row.answer ?? ""} ${row.created_by_user?.name ?? ""} ${row.created_by_user?.email ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [filter, queries]);

  const handleCsvSelected = async (file: File | null) => {
    if (!file) return;

    setUploadStatus(null);
    setSubmitError(null);
    setIsUploadingCsv(true);

    try {
      const text = await file.text();
      const rows = parseQueryAnswerCsv(text);

      if (rows.length === 0) {
        throw new Error("CSV has no data rows.");
      }

      const invalid = rows.find(
        (row) => !row.query.trim() || !row.answer.trim() || row.answer.trim().length <= 20
      );
      if (invalid) {
        throw new Error(
          'Each row must include non-empty "query" and "answer", and answer must be more than 20 characters.'
        );
      }

      const response = await fetch("/api/registrar/cached-queries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const json = (await response.json().catch(() => null)) as
        | { cachedQueries?: CachedQueryRow[]; insertedCount?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(json?.error || "Failed to upload CSV.");
      }

      const inserted = json?.cachedQueries ?? [];
      if (inserted.length > 0) {
        setQueries((prev) => [...inserted, ...prev]);
      }

      setUploadStatus(`Uploaded ${json?.insertedCount ?? inserted.length} queries from CSV.`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to upload CSV.");
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleCreateCachedQuery = async () => {
    const trimmedQuery = newQuery.trim();
    if (!trimmedQuery) {
      setSubmitError("Query is required.");
      return;
    }

    const trimmedAnswer = newAnswer.trim();
    if (!trimmedAnswer) {
      setSubmitError("Answer is required.");
      return;
    }

    if (trimmedAnswer.length <= 20) {
      setSubmitError("Answer must be more than 20 characters.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/registrar/cached-queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery, answer: trimmedAnswer }),
      });

      const json = (await response.json().catch(() => null)) as
        | { cachedQuery?: CachedQueryRow; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(json?.error || "Failed to create cached query.");
      }

      if (json?.cachedQuery) {
        setQueries((prev) => [json.cachedQuery!, ...prev]);
      }

      setIsAddOpen(false);
      setNewQuery("");
      setNewAnswer("");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create cached query."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Search
            </label>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by query / answer / user..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filtered.length}</span>{" "}
            of <span className="font-semibold text-gray-800">{queries.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setIsAddOpen(true);
            }}
            className="h-10 rounded-lg border border-blue-700 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100"
          >
            Add Query
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <span className="rounded-lg border border-green-700 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100">
              {isUploadingCsv ? "Uploading..." : "Upload CSV"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={isUploadingCsv}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                // allow selecting the same file again
                e.currentTarget.value = "";
                void handleCsvSelected(file);
              }}
            />
          </label>
        </div>
      </div>

      {uploadStatus ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {uploadStatus}
        </div>
      ) : null}

      {isAddOpen ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Add cached query</div>
              <div className="text-xs text-gray-600">
                Saves into Supabase table{" "}
                <code className="font-mono">cached_quries</code>.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isSubmitting) return;
                setIsAddOpen(false);
                setSubmitError(null);
              }}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Query <span className="text-red-600">*</span>
              </label>
              <textarea
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                rows={3}
                placeholder="Enter the query to cache…"
                className="w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Answer <span className="text-red-600">*</span>
              </label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                rows={4}
                placeholder="If you already have an answer, add it here…"
                className="w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {submitError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCreateCachedQuery}
                disabled={isSubmitting}
                className="h-10 rounded-lg border border-blue-700 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Save Query"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 font-semibold text-gray-700">Created</th>
                <th className="px-4 py-3 font-semibold text-gray-700">User</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Query</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Answer</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                    No cached queries found.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-medium">{row.created_by_user?.name ?? "—"}</div>
                      <div className="text-xs text-gray-500">{row.created_by_user?.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="max-w-[460px] whitespace-pre-wrap break-words">
                        {row.query}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="max-w-[460px] whitespace-pre-wrap break-words">
                        {row.answer ?? "—"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
