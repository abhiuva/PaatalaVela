"use client";

import { useEffect, useMemo, useState } from "react";
import { INDIA_TIME_ZONE } from "@/lib/schedule";

export function useIndiaTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const formattedTime = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("en-IN", {
            timeZone: INDIA_TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }).format(now)
        : "--:--:--",
    [now],
  );

  const formattedDate = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("en-IN", {
            timeZone: INDIA_TIME_ZONE,
            weekday: "short",
            day: "2-digit",
            month: "short",
          }).format(now)
        : "Loading",
    [now],
  );

  return { now: now ?? new Date(0), formattedTime, formattedDate, isReady: Boolean(now) };
}
