"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/common/button";

type RaisedTicket = {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string | null;
  student_course: string | null;
  raised_ticket: string;
  raised_at: string;
  resolved_answer: string | null;
  answered_at: string | null;
  valid_from: string | null;
  valid_till: string | null;
  no_expiry: boolean;
  conversation_id: string | null;
};

type TicketAnswerForm = {
  answer: string;
  valid_from: string;
  valid_till: string;
  no_expiry: boolean;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Something went wrong";
}

function toLocalDateTimeInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromIsoToLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return toLocalDateTimeInputValue(parsed);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString();
}

function createDefaultForm(ticket: RaisedTicket): TicketAnswerForm {
  const now = new Date();
  const defaultTill = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    answer: ticket.resolved_answer ?? "",
    valid_from: fromIsoToLocalInputValue(ticket.valid_from) || toLocalDateTimeInputValue(now),
    valid_till:
      fromIsoToLocalInputValue(ticket.valid_till) ||
      toLocalDateTimeInputValue(defaultTill),
    no_expiry: ticket.no_expiry,
  };
}

export default function StudentQueryPanel() {
  const [tickets, setTickets] = useState<RaisedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [answerForm, setAnswerForm] = useState<TicketAnswerForm | null>(null);
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
          .catch(() => ({ error: "Failed to load student tickets" }))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to load student tickets");
      }

      const payload = (await res.json()) as { tickets?: RaisedTicket[] };
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
      const aPending = a.resolved_answer ? 1 : 0;
      const bPending = b.resolved_answer ? 1 : 0;

      if (aPending !== bPending) {
        return aPending - bPending;
      }

      return Date.parse(b.raised_at) - Date.parse(a.raised_at);
    });

    return copy;
  }, [tickets]);

  const startAnswer = (ticket: RaisedTicket) => {
    setError("");
    setSuccess("");
    setEditingTicketId(ticket.id);
    setAnswerForm(createDefaultForm(ticket));
  };

  const cancelAnswer = () => {
    setEditingTicketId(null);
    setAnswerForm(null);
  };

  const submitAnswer = async () => {
    if (!editingTicketId || !answerForm || submittingId) {
      return;
    }

    const trimmedAnswer = answerForm.answer.trim();

    if (!trimmedAnswer) {
      setError("Answer is required");
      return;
    }

    if (!answerForm.no_expiry && (!answerForm.valid_from || !answerForm.valid_till)) {
      setError("valid_from and valid_till are required unless no_expiry is enabled");
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
          valid_from: answerForm.no_expiry ? null : answerForm.valid_from,
          valid_till: answerForm.no_expiry ? null : answerForm.valid_till,
          no_expiry: answerForm.no_expiry,
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

      setSuccess("Ticket answered successfully.");
      setEditingTicketId(null);
      setAnswerForm(null);
      await loadTickets(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading raised student queries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Pending queries: {tickets.filter((ticket) => !ticket.resolved_answer).length}
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
          const isPending = !ticket.resolved_answer;
          const isEditing = editingTicketId === ticket.id && answerForm;

          return (
            <div
              key={ticket.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{ticket.student_name}</h3>
                  <p className="text-sm text-gray-600">
                    Roll: {ticket.roll_number || "-"} | Course: {ticket.student_course || "-"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Raised at: {formatDateTime(ticket.raised_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isPending
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {isPending ? "Pending" : "Answered"}
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Raised Query
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-blue-900">
                  {ticket.raised_ticket}
                </p>
              </div>

              {!isPending ? (
                <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Registrar Answer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-green-900">
                    {ticket.resolved_answer}
                  </p>
                  <p className="mt-2 text-xs text-green-800">
                    Answered at: {formatDateTime(ticket.answered_at)}
                  </p>
                  <p className="text-xs text-green-800">
                    Validity: {ticket.no_expiry
                      ? "No expiry"
                      : `${formatDateTime(ticket.valid_from)} to ${formatDateTime(ticket.valid_till)}`}
                  </p>
                </div>
              ) : null}

              {isPending ? (
                <div className="mt-3">
                  {isEditing ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Answer
                      </label>
                      <textarea
                        value={answerForm.answer}
                        onChange={(event) =>
                          setAnswerForm((prev) =>
                            prev ? { ...prev, answer: event.target.value } : prev
                          )
                        }
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Write a clear response for the student"
                      />

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                            valid_from
                          </label>
                          <input
                            type="datetime-local"
                            value={answerForm.valid_from}
                            onChange={(event) =>
                              setAnswerForm((prev) =>
                                prev ? { ...prev, valid_from: event.target.value } : prev
                              )
                            }
                            disabled={answerForm.no_expiry}
                            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                            valid_till
                          </label>
                          <input
                            type="datetime-local"
                            value={answerForm.valid_till}
                            onChange={(event) =>
                              setAnswerForm((prev) =>
                                prev ? { ...prev, valid_till: event.target.value } : prev
                              )
                            }
                            disabled={answerForm.no_expiry}
                            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </div>
                      </div>

                      <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={answerForm.no_expiry}
                          onChange={(event) =>
                            setAnswerForm((prev) =>
                              prev ? { ...prev, no_expiry: event.target.checked } : prev
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        no_expiry
                      </label>

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
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startAnswer(ticket)}
                    >
                      Answer Query
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
