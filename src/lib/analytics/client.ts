"use client";

import type { AnalyticsEventName } from "@/types/database";
import { BRAND, LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/config/brand";
import { readMigratedStorageValue } from "@/lib/storage/migrate";

export type AnalyticsConsent = "unknown" | "accepted" | "rejected";
export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsProvider = {
  track: (eventName: AnalyticsEventName, properties: AnalyticsProperties) => void;
};

const CONSENT_KEY = STORAGE_KEYS.analyticsConsent;
let provider: AnalyticsProvider = { track: () => undefined };

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") {
    return "unknown";
  }
  const value = readMigratedStorageValue(
    window.localStorage,
    CONSENT_KEY,
    LEGACY_STORAGE_KEYS.analyticsConsent,
    (candidate) => candidate === "accepted" || candidate === "rejected",
  );
  return value === "accepted" || value === "rejected" ? value : "unknown";
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, "unknown">) {
  window.localStorage.setItem(CONSENT_KEY, consent);
  initialiseAnalytics();
  window.dispatchEvent(new CustomEvent("analytics-consent-changed", { detail: consent }));
}

function posthogProvider(): AnalyticsProvider {
  return {
    track(eventName, properties) {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
      if (!key) {
        return;
      }
      fetch(`${host.replace(/\/$/, "")}/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event: eventName,
          properties: {
            distinct_id: properties.session_id ?? "anonymous-session",
            ...properties,
          },
        }),
        keepalive: true,
      }).catch(() => undefined);
    },
  };
}

function ingestionProvider(): AnalyticsProvider {
  return {
    track(eventName, properties) {
      fetch("/api/analytics/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventName, properties }),
        keepalive: true,
      }).catch(() => undefined);
    },
  };
}

export function initialiseAnalytics() {
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") {
    provider = { track: () => undefined };
    return provider;
  }

  if (getAnalyticsConsent() !== "accepted") {
    provider = { track: () => undefined };
    return provider;
  }

  provider = process.env.NEXT_PUBLIC_POSTHOG_KEY ? posthogProvider() : ingestionProvider();
  return provider;
}

export function trackEvent(eventName: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  try {
    provider.track(eventName, { app_name: BRAND.name, ...properties });
  } catch {
    // Analytics must never affect radio playback.
  }
}

export function getOrCreateSessionId() {
  if (typeof window !== "undefined") {
    const existing = readMigratedStorageValue(
      window.sessionStorage,
      STORAGE_KEYS.browserSession,
      LEGACY_STORAGE_KEYS.browserSession,
      (value) => /^session_[A-Za-z0-9_-]+$/.test(value),
    );
    if (existing) return existing;
  }
  let created: string;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    created = `session_${crypto.randomUUID()}`;
  } else {
    created = `session_${Date.now().toString(36)}`;
  }
  if (typeof window !== "undefined") window.sessionStorage.setItem(STORAGE_KEYS.browserSession, created);
  return created;
}
