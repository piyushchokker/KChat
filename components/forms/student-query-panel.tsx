"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/common/button";

type Ticket = {
  id: string;
  query: string;
  status: string;
  priority: string;
  category: string | null;
  confidence_score: number | null;
  conversation_id: string | null;
  user_id: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  student_name: string;
  student_email: string;
  roll_number: string | null;
  student_course: string | null;
  student_school: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Something went wrong";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString();
}

function statusBadge(status: string) {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-700 border border-red-200";
    case "medium":
      return "bg-yellow-50 text-yellow-700 border border-yellow-200";
    case "low":
      return "bg-green-50 text-green-700 border border-green-200";
    default:
      return "bg-gray-50 text-gray-700 border border-gray-200";
  }
}

export default function StudentQueryPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTickets = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const res = await fetch("/api/registrar/tickets", { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res
          .json()
          .catch(() => ({ error: "Failed to load tickets" }))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to load tickets");
      }

      const payload = (await res.json()) as { tickets?: Ticket[] };
      setTickets(payload.tickets ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const orderedTickets = useMemo(() => {
    const copy = [...tickets];

    copy.sort((a, b) => {
      const aResolved = a.status === "resolved" || a.status === "closed" ? 1 : 0;
      const bResolved = b.status === "resolved" || b.status === "closed" ? 1 : 0;

      if (aResolved !== bResolved) {
        return aResolved - bResolved;
      }

      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });

    return copy;
  }, [tickets]);

  const startAnswer = (ticket: Ticket) => {
    setError("");
    setSuccess("");
    setEditingTicketId(ticket.id);
    setAnswerText("");
  };

  const cancelAnswer = () => {
    setEditingTicketId(null);
    setAnswerText("");
  };

  const submitAnswer = async () => {
    if (!editingTicketId || submittingId) {
      return;
    }

    const trimmedAnswer = answerText.trim();

    if (!trimmedAnswer) {
      setError("Answer is required");
      return;
    }

    setSubmittingId(editingTicketId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/registrar/tickets/${editingTicketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: trimmedAnswer,
        }),
      });

      if (!res.ok) {
        const payload = (await res
          .json()
          .catch(() => ({ error: "Failed to submit answer" }))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to submit answer");
      }

      setSuccess("Ticket resolved successfully.");
      setEditingTicketId(null);
      setAnswerText("");
      await loadTickets(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  const deleteTicket = async (ticket: Ticket) => {
    if (deletingId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete this query from ${ticket.student_name}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(ticket.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/registrar/tickets/${ticket.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = (await res
          .json()
          .catch(() => ({ error: "Failed to delete ticket" }))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to delete ticket");
      }

      if (editingTicketId === ticket.id) {
        setEditingTicketId(null);
        setAnswerText("");
      }

      setTickets((prev) => prev.filter((item) => item.id !== ticket.id));
      setSuccess("Ticket deleted successfully.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading raised student queries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Pending queries: {tickets.filter((t) => t.status === "open" || t.status === "in_progress").length}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          isLoading={refreshing}
          onClick={() => loadTickets(true)}
          className="h-10"
        >
          Refresh Queries
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-600">{success}</p> : null}

      {orderedTickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          No raised student queries found.
        </div>
      ) : (
        orderedTickets.map((ticket) => {
          const isPending = ticket.status === "open" || ticket.status === "in_progress";
          const isResolved = ticket.status === "resolved" || ticket.status === "closed";
          const isEditing = editingTicketId === ticket.id;

          return (
            <div
              key={ticket.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {ticket.student_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Roll: {ticket.roll_number || "-"} | Course: {ticket.student_course || "-"}
                  </p>
                  {ticket.student_school ? (
                    <p className="text-xs text-gray-500">School: {ticket.student_school}</p>
                  ) : null}
                  <p className="text-xs text-gray-500">
                    Raised at: {formatDateTime(ticket.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(ticket.status)}`}
                  >
                    {statusLabel(ticket.status)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadge(ticket.priority)}`}
                  >
                    {ticket.priority}
                  </span>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Student Query
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-blue-900">
                  {ticket.query}
                </p>
              </div>

              {isResolved && ticket.resolved_at ? (
                <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Resolved
                  </p>
                  <p className="mt-1 text-xs text-green-800">
                    Resolved at: {formatDateTime(ticket.resolved_at)}
                  </p>
                  {ticket.assigned_to ? (
                    <p className="text-xs text-green-800">
                      Handled by registrar
                    </p>
                  ) : null}
                </div>
              ) : null}

              {ticket.category ? (
                <p className="mt-2 text-xs text-gray-500">
                  Category: {ticket.category}
                </p>
              ) : null}

              <div className="mt-3">
                {isPending ? (
                  isEditing ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Your Answer
                      </label>
                      <textarea
                        value={answerText}
                        onChange={(event) => setAnswerText(event.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Write a clear response for the student's query"
                      />

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          isLoading={submittingId === ticket.id}
                          onClick={submitAnswer}
                        >
                          Submit Answer
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={cancelAnswer}
                          disabled={submittingId === ticket.id}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          isLoading={deletingId === ticket.id}
                          onClick={() => deleteTicket(ticket)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={submittingId === ticket.id}
                        >
                          Delete Query
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startAnswer(ticket)}
                      >
                        Answer Query
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isLoading={deletingId === ticket.id}
                        onClick={() => deleteTicket(ticket)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Delete Query
                      </Button>
                    </div>
                  )
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    isLoading={deletingId === ticket.id}
                    onClick={() => deleteTicket(ticket)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Delete Query
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
