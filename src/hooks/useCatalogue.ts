"use client";

import { useEffect, useState } from "react";
import { getEmptyCatalogue, getLocalCatalogue } from "@/lib/catalogue/local";
import type { PublicCatalogue } from "@/lib/catalogue/types";

const initialCatalogue = getEmptyCatalogue("Loading production catalogue.");

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<PublicCatalogue>(initialCatalogue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/catalogue")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Catalogue request failed.");
        }
        return response.json() as Promise<PublicCatalogue>;
      })
      .then((nextCatalogue) => {
        if (!cancelled) {
          setCatalogue(nextCatalogue);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogue(getLocalCatalogue("Supabase catalogue request failed. Local read-only fallback is active.", "CATALOGUE_QUERY_FAILED"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ...catalogue,
    isLoading,
  };
}
