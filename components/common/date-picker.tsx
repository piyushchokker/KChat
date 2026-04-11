"use client";

import { useState, useRef, useEffect } from "react";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  footer?: boolean;
  locale?: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export default function DatePicker({
  value,
  onChange,
  label = "Select Date",
  placeholder = "Choose a date",
  footer = true,
  locale = "en-US",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = value || "";
  const initialViewDate = selectedDate
    ? parseLocalDate(selectedDate) ?? new Date()
    : new Date();
  const [displayDate, setDisplayDate] = useState<Date>(
    initialViewDate
  );
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOpen = () => {
    if (!isOpen) {
      const nextViewDate = selectedDate
        ? parseLocalDate(selectedDate) ?? new Date()
        : new Date();
      setDisplayDate(nextViewDate);
    }

    setIsOpen((prev) => !prev);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleDateClick = (day: number) => {
    const selected = new Date(displayDate.getFullYear(), displayDate.getMonth(), day);
    const formatted = formatLocalDate(selected);
    onChange(formatted);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1));
  };

  const handleToday = () => {
    const today = new Date();
    const formatted = formatLocalDate(today);
    onChange(formatted);
    setDisplayDate(today);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setDisplayDate(new Date());
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const daysInMonth = getDaysInMonth(displayDate);
  const firstDay = getFirstDayOfMonth(displayDate);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const formattedValue = selectedDate
    ? (parseLocalDate(selectedDate) ?? new Date()).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : placeholder;

  return (
    <div ref={pickerRef} className="relative">
      {label && <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>}

      {/* Input Field */}
      <div
        onClick={handleToggleOpen}
        className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 transition-all hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200"
      >
        <span className={selectedDate ? "text-gray-900" : "text-gray-400"}>
          {formattedValue}
        </span>
        <svg
          className="h-5 w-5 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {/* Calendar Picker */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Month Dropdown */}
            <select
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-900"
              value={displayDate.getMonth()}
              onChange={e => setDisplayDate(new Date(displayDate.getFullYear(), Number(e.target.value), 1))}
            >
              {monthNames.map((month, idx) => (
                <option key={month} value={idx}>{month}</option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-900"
              value={displayDate.getFullYear()}
              onChange={e => setDisplayDate(new Date(Number(e.target.value), displayDate.getMonth(), 1))}
            >
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - 50 + i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 border-b border-gray-200 px-4 py-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 px-4 py-3">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => day && handleDateClick(day)}
                disabled={!day}
                className={`rounded py-2 text-sm font-medium transition-colors disabled:text-gray-300 ${
                  day === null
                    ? "cursor-default"
                    : selectedDate === `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-700 hover:bg-blue-50"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={handleToday}
                className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
