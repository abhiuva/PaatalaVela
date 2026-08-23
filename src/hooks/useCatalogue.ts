"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEmptyCatalogue, getLocalCatalogue } from "@/lib/catalogue/local";
import type { PublicCatalogue } from "@/lib/catalogue/types";

const initialCatalogue = getEmptyCatalogue("Loading production catalogue.");

type ChannelLoadState = {
  channelId: string | null;
  status: "idle" | "loading" | "ready" | "error";
};

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<PublicCatalogue>(initialCatalogue);
  const [isLoading, setIsLoading] = useState(true);
  const [channelLoadState, setChannelLoadState] = useState<ChannelLoadState>({ channelId: null, status: "idle" });
  const channelRequestRef = useRef<{ id: number; controller: AbortController } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/catalogue", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Catalogue request failed.");
        }
        return response.json() as Promise<PublicCatalogue>;
      })
      .then((nextCatalogue) => {
        if (!controller.signal.aborted) {
          setCatalogue(nextCatalogue);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalogue(getLocalCatalogue("Supabase catalogue request failed. Local read-only fallback is active.", "CATALOGUE_QUERY_FAILED"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const refreshChannel = useCallback(async (channelId: string) => {
    channelRequestRef.current?.controller.abort();
    const id = (channelRequestRef.current?.id ?? 0) + 1;
    const controller = new AbortController();
    channelRequestRef.current = { id, controller };
    setChannelLoadState({ channelId, status: "loading" });

    try {
      const response = await fetch(`/api/catalogue/channels/${encodeURIComponent(channelId)}?catalogueVersion=v1`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Channel request failed.");
      }

      const payload = await response.json() as { channel: PublicCatalogue["channels"][number] };
      if (channelRequestRef.current?.id !== id || controller.signal.aborted) {
        return null;
      }

      setCatalogue((current) => ({
        ...current,
        channels: current.channels.map((channel) => channel.id === channelId ? payload.channel : channel),
      }));
      setChannelLoadState({ channelId, status: "ready" });
      return payload.channel;
    } catch {
      if (channelRequestRef.current?.id !== id || controller.signal.aborted) {
        return null;
      }
      setChannelLoadState({ channelId, status: "error" });
      return null;
    }
  }, []);

  useEffect(() => () => channelRequestRef.current?.controller.abort(), []);

  return {
    ...catalogue,
    isLoading,
    channelLoadState,
    refreshChannel,
  };
}
