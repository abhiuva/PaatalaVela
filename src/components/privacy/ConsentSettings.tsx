"use client";

import Link from "next/link";
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics/client";
import { useEffect, useState } from "react";

export function ConsentSettings() {
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");

  useEffect(() => {
    const timeout = window.setTimeout(() => setConsent(getAnalyticsConsent()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="rounded-md border border-white/12 bg-white/5 p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-white">Optional analytics</span>
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${consent === "accepted" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/15 text-white/60"}`}>
          {consent === "accepted" ? "Enabled" : consent === "rejected" ? "Disabled" : "Not chosen"}
        </span>
      </div>
      <p className="mt-2 leading-5 text-white/58">Anonymous listening analytics stay off until you enable them.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setAnalyticsConsent("accepted"); setConsent("accepted"); }} className="rounded-md border border-white/20 px-2.5 py-1.5 font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">
          Enable analytics
        </button>
        <button type="button" onClick={() => { setAnalyticsConsent("rejected"); setConsent("rejected"); }} className="rounded-md border border-white/20 px-2.5 py-1.5 font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">
          Disable analytics
        </button>
        <Link href="/privacy" className="px-1 py-1.5 font-bold text-white/75 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white">Privacy details</Link>
      </div>
    </div>
  );
}
