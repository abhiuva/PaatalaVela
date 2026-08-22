"use client";

import { useEffect, useRef } from "react";
import { presenceConfig } from "@/lib/presence/config";

const SESSION_KEY = "paatalavela.presence-session";
const HIDDEN_PAUSE_MS = 60_000;

function browserSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

type PresenceOptions = {
  isPlaying: boolean;
  hasUserInteracted: boolean;
  channelSlug: string;
  songId?: string;
};

export function useListenerPresence({ isPlaying, hasUserInteracted, channelSlug, songId }: PresenceOptions) {
  const activeRef = useRef(false);

  useEffect(() => {
    if (!hasUserInteracted) return;
    const sessionId = browserSessionId();
    let hiddenTimer: number | undefined;

    const payload = (playerState: "playing" | "paused" | "stopped") => JSON.stringify({ sessionId, channelSlug, songId: songId ?? null, playerState });
    const send = async (playerState: "playing" | "paused" | "stopped") => {
      try {
        const response = await fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: payload(playerState), keepalive: true });
        if (response.ok && playerState === "playing") window.dispatchEvent(new Event("presence-heartbeat"));
      } catch {
        // Presence is operational metadata and must never affect playback.
      }
    };
    const finalSignal = () => {
      if (!activeRef.current) return;
      const body = new Blob([payload("stopped")], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/presence", body)) void send("stopped");
      activeRef.current = false;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && activeRef.current) {
        hiddenTimer = window.setTimeout(() => { void send("paused"); activeRef.current = false; }, HIDDEN_PAUSE_MS);
      } else if (document.visibilityState === "visible") {
        if (hiddenTimer) window.clearTimeout(hiddenTimer);
        if (isPlaying) { activeRef.current = true; void send("playing"); }
      }
    };

    if (isPlaying) {
      activeRef.current = true;
      void send("playing");
    } else if (activeRef.current) {
      activeRef.current = false;
      void send("paused");
    }
    const interval = window.setInterval(() => {
      if (isPlaying && activeRef.current && document.visibilityState === "visible") void send("playing");
    }, presenceConfig.heartbeatMs);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", finalSignal);
    return () => {
      window.clearInterval(interval);
      if (hiddenTimer) window.clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", finalSignal);
    };
  }, [channelSlug, hasUserInteracted, isPlaying, songId]);
}
