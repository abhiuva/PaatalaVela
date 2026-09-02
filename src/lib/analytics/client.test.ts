import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/config/brand";
import { getAnalyticsConsent, getOrCreateSessionId } from "@/lib/analytics/client";

describe("CassettePlay analytics preference migration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("preserves accepted consent while migrating the legacy key", () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.analyticsConsent[0], "accepted");
    expect(getAnalyticsConsent()).toBe("accepted");
    expect(localStorage.getItem(STORAGE_KEYS.analyticsConsent)).toBe("accepted");
    expect(localStorage.getItem(LEGACY_STORAGE_KEYS.analyticsConsent[0])).toBeNull();
  });

  it("preserves a valid legacy browser session", () => {
    sessionStorage.setItem(LEGACY_STORAGE_KEYS.browserSession[0], "session_existing-listener");
    expect(getOrCreateSessionId()).toBe("session_existing-listener");
    expect(sessionStorage.getItem(STORAGE_KEYS.browserSession)).toBe("session_existing-listener");
    expect(sessionStorage.getItem(LEGACY_STORAGE_KEYS.browserSession[0])).toBeNull();
  });

  it("does not migrate invalid legacy state", () => {
    localStorage.setItem(LEGACY_STORAGE_KEYS.analyticsConsent[0], "maybe");
    sessionStorage.setItem(LEGACY_STORAGE_KEYS.browserSession[0], "invalid session");
    vi.stubGlobal("crypto", { randomUUID: () => "8704c057-a14d-45a5-88db-918f86c1614f" });
    expect(getAnalyticsConsent()).toBe("unknown");
    expect(getOrCreateSessionId()).toBe("session_8704c057-a14d-45a5-88db-918f86c1614f");
    expect(localStorage.getItem(LEGACY_STORAGE_KEYS.analyticsConsent[0])).toBe("maybe");
    expect(sessionStorage.getItem(LEGACY_STORAGE_KEYS.browserSession[0])).toBe("invalid session");
  });
});
