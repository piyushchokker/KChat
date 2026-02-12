"use client";

import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  selected: UserRole | null;
  onSelect: (role: UserRole) => void;
}

export default function RoleSelector({ selected, onSelect }: RoleSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect("student")}
        className={cn(
          "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-200",
          selected === "student"
            ? "text-white shadow-md"
            : "text-gray-600 hover:text-gray-900"
        )}
        style={selected === "student" ? { background: '#065ea7' } : {}}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
        Student
      </button>
      <button
        type="button"
        onClick={() => onSelect("registrar")}
        className={cn(
          "flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-200",
          selected === "registrar"
            ? "text-white shadow-md"
            : "text-gray-600 hover:text-gray-900"
        )}
        style={selected === "registrar" ? { background: '#1a1a1a' } : {}}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        Registrar
      </button>
    </div>
  );
}
