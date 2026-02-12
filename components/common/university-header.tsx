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
      className="flex w-full items-center justify-between px-6 py-3 text-white shadow-md"
      style={{
        background: `linear-gradient(to right, #0066ff 0%, #ff0000 100%)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1 overflow-hidden">
          <Image
            src="/krmu.jpeg"
            alt={`${UNIVERSITY_NAME} Logo`}
            width={32}
            height={32}
            className="object-contain"
          />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight tracking-wide">
            {UNIVERSITY_NAME}
          </h1>
          {subtitle && (
            <p className="text-xs font-medium text-blue-200">{subtitle}</p>
          )}
        </div>
      </div>
      {rightContent && <div>{rightContent}</div>}
    </header>
  );
}
