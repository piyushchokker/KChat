"use client";

import { UNIVERSITY_NAME } from "@/utils/constants";

interface UniversityHeaderProps {
  subtitle?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export default function UniversityHeader({
  subtitle,
  leftContent,
  rightContent,
}: UniversityHeaderProps) {
  return (
    <header
      className="flex w-full items-center justify-between bg-gradient-to-r from-blue-600 to-red-600 px-3 py-3 text-white shadow-md dark:from-blue-900/80 dark:via-slate-900 dark:to-rose-900/80 sm:px-6"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {leftContent && <div className="shrink-0">{leftContent}</div>}
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold leading-tight tracking-wide truncate">
            {UNIVERSITY_NAME}
          </h1>
          {subtitle && (
            <p className="text-xs font-medium text-blue-100 dark:text-zinc-300">{subtitle}</p>
          )}
        </div>
      </div>
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </header>
  );
}
