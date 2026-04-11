"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      "aria-busy": ariaBusy,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const resolvedBusy =
      isLoading || ariaBusy === true || ariaBusy === "true";

    const variants = {
      primary:
        "bg-blue-800 text-white hover:bg-blue-900 focus:ring-blue-500/30 shadow-md",
      secondary:
        "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-400/30",
      outline:
        "border-2 border-blue-800 text-blue-800 hover:bg-blue-50 focus:ring-blue-500/30",
      ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-6 text-sm",
      lg: "h-12 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={resolvedBusy || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
