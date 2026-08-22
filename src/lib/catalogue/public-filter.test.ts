import { readFileSync } from "node:fs";
import path from "node:path";
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

  it("provides channel shells without active fallback songs", () => {
    const fallback = getLocalCatalogue("test fallback");
    expect(fallback.source).toBe("local");
    expect(fallback.channels).toHaveLength(8);
    expect(fallback.channels.find((channel) => channel.slug === "english-hits")).toMatchObject({ scheduled: false, songs: [] });
    expect(fallback.channels.find((channel) => channel.slug === "hindi-hits")).toMatchObject({ scheduled: false, mode: "on_demand", languageCode: "hi", songs: [] });
    expect(fallback.channels.every((channel) => channel.songs.length === 0)).toBe(true);
    expect(fallback.fallbackReason).toBe("test fallback");
  });

  it("keeps fallback diagnostics explicit", () => {
    const fallback = getLocalCatalogue("request failed", "CATALOGUE_QUERY_FAILED");
    expect(fallback.diagnosticCode).toBe("CATALOGUE_QUERY_FAILED");
  });

  it("shows the required empty-channel message instead of fallback media", () => {
    const playerSource = readFileSync(path.join(process.cwd(), "src/components/RadioPlayer.tsx"), "utf8");
    expect(playerSource).toContain("Songs are being added to this channel.");
  });
});
