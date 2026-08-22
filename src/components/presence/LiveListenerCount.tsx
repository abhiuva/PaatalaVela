"use client";

import { useCallback, useEffect, useState } from "react";
import { presenceConfig, type SocialProofThresholds } from "@/lib/presence/config";

type CountState =
  | { status: "loading" }
  | { status: "ready"; total: number; channel: number | null; daily: number | null; thresholds: SocialProofThresholds; asOf: string }
  | { status: "error" };

export function listenerCountText(state: CountState, channelName = "this channel") {
  if (state.status === "loading") return "Checking listener activity";
  if (state.status === "error") return "Listener activity unavailable";
  if (state.channel != null && state.channel >= state.thresholds.channel) return `${state.channel} people are listening to ${channelName}`;
  if (state.total >= state.thresholds.concurrent) return `${state.total} people listening now`;
  if (state.daily != null && state.daily >= state.thresholds.daily) return `${state.daily} people tuned in today`;
  return "Join today’s listeners";
}

export function LiveListenerCount({ channelSlug, channelName }: { channelSlug: string; channelName: string }) {
  const [state, setState] = useState<CountState>({ status: "loading" });
  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), presenceConfig.requestTimeoutMs);
    try {
      const response = await fetch(`/api/presence/count?channel=${encodeURIComponent(channelSlug)}`, { cache: "no-store", signal: controller.signal });
      const body = (await response.json()) as { ok?: boolean; total?: number; channel?: number | null; daily?: number | null; asOf?: string; thresholds?: SocialProofThresholds };
      if (!response.ok || !body.ok || typeof body.total !== "number" || !body.thresholds || !body.asOf) { setState({ status: "error" }); return; }
      setState({ status: "ready", total: body.total, channel: typeof body.channel === "number" ? body.channel : null, daily: typeof body.daily === "number" ? body.daily : null, thresholds: body.thresholds, asOf: body.asOf });
    } catch { setState({ status: "error" }); }
    finally { window.clearTimeout(timeout); }
  }, [channelSlug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), presenceConfig.countRefreshMs);
    const reconnect = () => void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("presence-heartbeat", reconnect);
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); window.removeEventListener("presence-heartbeat", reconnect); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  const active = state.status === "ready" && state.total > 0;
  const text = listenerCountText(state, channelName);
  return <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-100/20 bg-black/28 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-black/15 backdrop-blur" aria-label={`Listener status: ${text}`} aria-live="polite">
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${active ? "border-emerald-200 bg-emerald-300" : "border-white/50 bg-transparent"}`} aria-hidden="true" />
    <span>{text}</span>
  </div>;
}
