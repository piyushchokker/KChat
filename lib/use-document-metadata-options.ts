"use client";

import { useEffect, useState } from "react";
import { buildFallbackFrontendMetadataOptions } from "@/lib/document-metadata-defaults";
import type { FrontendMetadataOptions } from "@/types/document-metadata-options";

type MetadataOptionsResponse = {
  options?: FrontendMetadataOptions;
  error?: string;
};

const FALLBACK_METADATA_OPTIONS = buildFallbackFrontendMetadataOptions();

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Failed to fetch metadata options";
}

export function useDocumentMetadataOptions() {
  const [options, setOptions] = useState<FrontendMetadataOptions>(
    FALLBACK_METADATA_OPTIONS
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadOptions = async () => {
      try {
        const response = await fetch("/api/documents/metadata-options", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response
            .json()
            .catch(() => ({ error: "Failed to fetch metadata options" }))) as {
            error?: string;
          };
          throw new Error(payload.error || "Failed to fetch metadata options");
        }

        const payload = (await response.json()) as MetadataOptionsResponse;
        if (isActive && payload.options) {
          setOptions(payload.options);
        }
      } catch (err: unknown) {
        if (!isActive || controller.signal.aborted) {
          return;
        }

        setError(getErrorMessage(err));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadOptions();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return {
    options,
    isLoading,
    error,
  };
}
