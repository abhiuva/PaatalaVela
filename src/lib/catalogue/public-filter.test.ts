import { describe, expect, it } from "vitest";
import { getLocalCatalogue } from "@/lib/catalogue/local";
import { isPublicPlayableSong } from "@/lib/catalogue/public-filter";

describe("public catalogue filtering", () => {
  it("excludes inactive songs from public playback", () => {
    expect(isPublicPlayableSong(false, "available")).toBe(false);
  });

  it("excludes unavailable songs from public playback", () => {
    expect(isPublicPlayableSong(true, "unavailable")).toBe(false);
    expect(isPublicPlayableSong(true, "embedding_disabled")).toBe(false);
    expect(isPublicPlayableSong(true, "region_restricted")).toBe(false);
  });

  it("allows active available songs for public playback", () => {
    expect(isPublicPlayableSong(true, "available")).toBe(true);
  });

  it("provides local fallback catalogue with all locked channels", () => {
    const fallback = getLocalCatalogue("test fallback");
    expect(fallback.source).toBe("local");
    expect(fallback.channels).toHaveLength(6);
    expect(fallback.fallbackReason).toBe("test fallback");
  });

  it("keeps fallback diagnostics explicit", () => {
    const fallback = getLocalCatalogue("request failed", "CATALOGUE_QUERY_FAILED");
    expect(fallback.diagnosticCode).toBe("CATALOGUE_QUERY_FAILED");
  });
});
