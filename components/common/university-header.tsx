"use client";

import Image from "next/image";
import { UNIVERSITY_NAME } from "@/utils/constants";

interface UniversityHeaderProps {
  subtitle?: string;
  rightContent?: React.ReactNode;
}

export default function UniversityHeader({
  subtitle,
  rightContent,
}: UniversityHeaderProps) {
  return (
    <header 
      className="flex w-full items-center justify-between px-3 sm:px-6 py-3 text-white shadow-md"
      style={{
        background: `linear-gradient(to right, #0066ff 0%, #ff0000 100%)`,
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white p-1 overflow-hidden">
          <Image
            src="/krmu.jpeg"
            alt={`${UNIVERSITY_NAME} Logo`}
            width={32}
            height={32}
            className="object-contain"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold leading-tight tracking-wide truncate">
            {UNIVERSITY_NAME}
          </h1>
          {subtitle && (
            <p className="text-xs font-medium text-blue-200">{subtitle}</p>
          )}
        </div>
      </div>
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </header>
  );
}
