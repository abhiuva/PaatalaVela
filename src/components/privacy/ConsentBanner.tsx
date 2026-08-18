"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAnalyticsConsent, initialiseAnalytics, setAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics/client";

export function ConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setConsent(getAnalyticsConsent());
      initialiseAnalytics();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (consent !== "unknown") {
    return null;
  }

  return (
    <section className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-lg border border-white/20 bg-neutral-950/95 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur" aria-label="Analytics consent">
      <p className="text-sm leading-6 text-white/78">
        We use optional anonymous analytics to understand listening quality and sponsor performance. The radio works normally if you reject.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setAnalyticsConsent("accepted");
            setConsent("accepted");
          }}
          className="rounded-md border border-white/25 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
        >
          Accept analytics
        </button>
        <button
          type="button"
          onClick={() => {
            setAnalyticsConsent("rejected");
            setConsent("rejected");
          }}
          className="rounded-md border border-white/25 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
        >
          Reject analytics
        </button>
        <Link href="/privacy" className="rounded-md border border-white/25 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">
          View privacy policy
        </Link>
      </div>
    </section>
  );
}
