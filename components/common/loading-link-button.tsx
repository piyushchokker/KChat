"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Button from "@/components/common/button";

type LoadingLinkButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "type" | "onClick" | "isLoading"
> & {
  href: string;
  replace?: boolean;
};

export default function LoadingLinkButton({
  href,
  replace = false,
  children,
  disabled,
  ...buttonProps
}: LoadingLinkButtonProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isLoading = isNavigating || isPending;

  const handleClick = () => {
    if (disabled || isLoading) return;

    setIsNavigating(true);
    startTransition(() => {
      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    });
  };

  return (
    <Button
      type="button"
      disabled={disabled}
      isLoading={isLoading}
      onClick={handleClick}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}
