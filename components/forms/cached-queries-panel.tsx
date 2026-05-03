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
  created_by_user?: CachedQueryUser;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(rows: CachedQueryRow[]): string {
  const header = ["created_at", "created_by_name", "created_by_email", "query", "answer"];
  const lines = [header.join(",")];

  for (const row of rows) {
    const createdByName = row.created_by_user?.name ?? "";
    const createdByEmail = row.created_by_user?.email ?? "";
    lines.push(
      [
        csvEscape(row.created_at),
        csvEscape(createdByName),
        csvEscape(createdByEmail),
        csvEscape(row.query ?? ""),
        csvEscape(row.answer ?? ""),
      ].join(",")
    );
  }

  return lines.join("\n");
}

export default function CachedQueriesPanel({
  initialQueries,
}: {
  initialQueries: CachedQueryRow[];
}) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return initialQueries;

    return initialQueries.filter((row) => {
      const haystack =
        `${row.query} ${row.answer ?? ""} ${row.created_by_user?.name ?? ""} ${row.created_by_user?.email ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [filter, initialQueries]);

  const handleDownloadCsv = () => {
    const csv = buildCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cached_quries_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
            of <span className="font-semibold text-gray-800">{initialQueries.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="h-10 rounded-lg border border-green-700 bg-green-50 px-4 text-sm font-semibold text-green-800 hover:bg-green-100"
          >
            Download CSV
          </button>
        </div>
      </div>

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

