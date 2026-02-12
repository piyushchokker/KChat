"use client";

import { useState, useRef, useEffect } from "react";

interface AcademicYearPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function AcademicYearPicker({
  value,
  onChange,
  placeholder = "-- Select Academic Year --",
}: AcademicYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectYear = (year: number) => {
    const academicYear = `${year}-${year + 1}`;
    setInputValue(academicYear);
    onChange(academicYear);
    setIsOpen(false);
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    // Validate format YYYY-YYYY
    if (/^\d{4}-\d{4}$/.test(val)) {
      onChange(val);
    }
  };

  const generateYearOptions = () => {
    const years = [];
    for (let i = currentYear + 5; i >= currentYear - 10; i--) {
      years.push(i);
    }
    return years;
  };

  const yearOptions = generateYearOptions();

  return (
    <div ref={pickerRef} className="relative">
      <label className="mb-2 block text-sm font-semibold text-gray-700">
        Academic Year
      </label>

      <div className="relative">
        {/* Input Field */}
        <div className="flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
          <svg
            className="h-4 w-4 text-gray-400"
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

          <input
            type="text"
            value={inputValue}
            onChange={handleManualInput}
            placeholder={placeholder}
            onFocus={() => setIsOpen(true)}
            className="ml-2 flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="ml-2 text-gray-500 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>

        {/* Calendar Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            {/* Year Navigation */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentYear(currentYear - 1)}
                className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
              >
                ← Prev
              </button>
              <span className="font-semibold text-gray-900">
                {currentYear} - {currentYear + 10}
              </span>
              <button
                type="button"
                onClick={() => setCurrentYear(currentYear + 1)}
                className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
              >
                Next →
              </button>
            </div>

            {/* Year Grid */}
            <div className="grid grid-cols-4 gap-2">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleSelectYear(year)}
                  className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                    inputValue === `${year}-${year + 1}`
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Help Text */}
            <p className="mt-4 text-xs text-gray-500">
              Select a year or type in format: YYYY-YYYY
            </p>
          </div>
        )}
      </div>

      {/* Format Helper */}
      <p className="mt-1 text-xs text-gray-500">
        Format: YYYY-YYYY (e.g., 2024-2025)
      </p>
    </div>
  );
}
