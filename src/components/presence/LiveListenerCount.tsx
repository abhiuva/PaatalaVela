"use client";

import { useCallback, useEffect, useState } from "react";

type CountState =
  | { status: "loading" }
  | { status: "ready"; total: number; channel: number | null }
  | { status: "error" };

export function listenerCountText(state: CountState) {
  if (state.status === "loading") return "Checking live listeners";
  if (state.status === "error") return "Live listeners unavailable";
  if (state.total === 0) return "Be the first listener";
  const total = `${state.total} listening now`;
  return state.channel == null ? total : `${total} · ${state.channel} on this channel`;
}

export function LiveListenerCount({ channelSlug }: { channelSlug: string }) {
  const [state, setState] = useState<CountState>({ status: "loading" });
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/presence/count?channel=${encodeURIComponent(channelSlug)}`, { cache: "no-store" });
      const body = (await response.json()) as { ok?: boolean; total?: number; channel?: number | null };
      if (!response.ok || !body.ok || typeof body.total !== "number") { setState({ status: "error" }); return; }
      setState({ status: "ready", total: body.total, channel: typeof body.channel === "number" ? body.channel : null });
    } catch { setState({ status: "error" }); }
  }, [channelSlug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 20_000);
    const onHeartbeat = () => void refresh();
    window.addEventListener("presence-heartbeat", onHeartbeat);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); window.removeEventListener("presence-heartbeat", onHeartbeat); };
  }, [refresh]);

  const active = state.status === "ready" && state.total > 0;
  return (
    <div className="inline-flex min-h-10 items-center gap-2 rounded-md border border-amber-100/20 bg-black/28 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-black/15 backdrop-blur" aria-label={`Live listener status: ${listenerCountText(state)}`} aria-live="polite">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${active ? "border-emerald-200 bg-emerald-300" : "border-white/50 bg-transparent"}`} aria-hidden="true" />
      <span>{listenerCountText(state)}</span>
    </div>
  );
}
