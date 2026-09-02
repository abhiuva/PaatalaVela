import { describe, expect, it } from "vitest";
import { LEGACY_STORAGE_KEYS } from "@/config/brand";
import { buildFirstShuffleCycle, createShuffleState, nextShuffledSong, previousShuffledSong, queueFingerprint, readShufflePreference, SHUFFLE_STORAGE_KEY } from "@/lib/radio/shuffle";
import type { QueueItem } from "@/lib/radio/queue";

function item(id: string, sequence: number, embedStatus: QueueItem["embedStatus"] = "available", languageCode = "te"): QueueItem {
  return { id, assignmentId: `assignment-${id}`, channelId: "channel-id", sequence, embedStatus, title: id, film: "Film", year: 2020, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode, eraCode: "2020s", moods: [], occasions: [], youtubeVideoId: `${id.padEnd(11, "x")}`.slice(0, 11), durationSeconds: 100, assignmentCreatedAt: "2026-01-01T00:00:00Z" };
}

function items(count: number, languageCode = "te") {
  return Array.from({ length: count }, (_, index) => item(String.fromCharCode(97 + index), index + 1, "available", languageCode));
}

const zero = () => 0;

describe("approved channel shuffle", () => {
  it("builds a randomized last-five-first queue and Fisher-Yates remainder", () => {
    const catalogue = items(10);
    const order = buildFirstShuffleCycle(catalogue, "assignment-a", ["assignment-a"], zero);
    expect(new Set(order.slice(0, 5))).toEqual(new Set(["assignment-f", "assignment-g", "assignment-h", "assignment-i", "assignment-j"]));
    expect(order.slice(0, 5)).not.toEqual(["assignment-f", "assignment-g", "assignment-h", "assignment-i", "assignment-j"]);
    expect(new Set(order.slice(5))).toEqual(new Set(["assignment-b", "assignment-c", "assignment-d", "assignment-e"]));
  });

  it("excludes current, ordinary next, and recent entries from immediate next when alternatives exist", () => {
    const catalogue = items(10);
    const order = buildFirstShuffleCycle(catalogue, "assignment-a", ["assignment-a", "assignment-g"], zero);
    expect(order[0]).not.toBe("assignment-a");
    expect(order[0]).not.toBe("assignment-b");
    expect(order[0]).not.toBe("assignment-g");
  });

  it("does not mutate catalogue rows or database sequences", () => {
    const catalogue = items(10);
    const before = JSON.stringify(catalogue);
    nextShuffledSong(createShuffleState("channel", catalogue, "assignment-a", zero), "channel", catalogue, "assignment-a", zero);
    expect(JSON.stringify(catalogue)).toBe(before);
    expect(catalogue.map((song) => song.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("offers every eligible entry once before creating a subsequent cycle", () => {
    const catalogue = items(6);
    let state = createShuffleState("channel", catalogue, "assignment-a", zero);
    let current = "assignment-a";
    const firstCycle = [current];
    for (let count = 0; count < 5; count += 1) {
      const result = nextShuffledSong(state, "channel", catalogue, current, zero);
      state = result.state;
      current = result.nextId!;
      firstCycle.push(current);
    }
    expect(new Set(firstCycle)).toEqual(new Set(catalogue.map((song) => song.assignmentId)));
    expect(state.cycleNumber).toBe(1);
    const nextCycle = nextShuffledSong(state, "channel", catalogue, current, zero);
    expect(nextCycle.state.cycleNumber).toBe(2);
    expect(nextCycle.nextId).not.toBe(current);
  });

  it("handles zero, one, two, three-to-five, and large catalogues", () => {
    expect(nextShuffledSong(createShuffleState("empty", [], null, zero), "empty", [], null, zero).nextId).toBeNull();
    const one = items(1);
    expect(nextShuffledSong(createShuffleState("one", one, "assignment-a", zero), "one", one, "assignment-a", zero).nextId).toBe("assignment-a");
    const two = items(2);
    expect(nextShuffledSong(createShuffleState("two", two, "assignment-a", zero), "two", two, "assignment-a", zero).nextId).toBe("assignment-b");
    for (const size of [3, 4, 5, 12]) {
      const catalogue = items(size);
      const order = createShuffleState(`size-${size}`, catalogue, "assignment-a", zero).remainingIds;
      expect(order).toHaveLength(size - 1);
      expect(new Set(order).size).toBe(size - 1);
      expect(order).not.toContain("assignment-a");
    }
  });

  it("keeps previous history while shuffle is active", () => {
    const catalogue = items(5);
    const next = nextShuffledSong(createShuffleState("channel", catalogue, "assignment-a", zero), "channel", catalogue, "assignment-a", zero);
    expect(previousShuffledSong(next.state, catalogue, next.nextId).previousId).toBe("assignment-a");
  });

  it("rebuilds by channel and never reuses the English queue", () => {
    const telugu = items(6);
    const english = items(8, "en").map((entry) => ({ ...entry, assignmentId: `english-${entry.assignmentId}` }));
    const teluguState = createShuffleState("telugu-uuid", telugu, "assignment-a", zero);
    const switched = nextShuffledSong(teluguState, "english-uuid", english, "english-assignment-a", zero);
    expect(switched.state.channelKey).toBe("english-uuid");
    expect(switched.state.remainingIds.every((id) => id.startsWith("english-"))).toBe(true);
  });

  it("reconciles catalogue refresh without replaying the consumed queue", () => {
    const original = items(6);
    const first = nextShuffledSong(createShuffleState("channel", original, "assignment-a", zero), "channel", original, "assignment-a", zero);
    const refreshed = [...original.filter((entry) => entry.assignmentId !== "assignment-f"), item("z", 7)];
    const second = nextShuffledSong(first.state, "channel", refreshed, first.nextId, zero);
    expect(second.nextId).not.toBe(first.nextId);
    expect(second.state.catalogueFingerprint).toBe(queueFingerprint(refreshed));
    expect(second.state.remainingIds).toContain("assignment-z");
  });

  it("migrates a valid legacy preference and leaves invalid legacy data untouched", () => {
    const values = new Map<string, string>([[LEGACY_STORAGE_KEYS.shuffle[0], JSON.stringify({ version: 1, enabled: true })]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    expect(readShufflePreference(storage)).toBe(true);
    expect(values.get(SHUFFLE_STORAGE_KEY)).toBe(JSON.stringify({ version: 2, enabled: true }));
    expect(values.has(LEGACY_STORAGE_KEYS.shuffle[0])).toBe(false);

    values.clear();
    values.set(LEGACY_STORAGE_KEYS.shuffle[0], "not-json");
    expect(readShufflePreference(storage)).toBe(false);
    expect(values.get(LEGACY_STORAGE_KEYS.shuffle[0])).toBe("not-json");
  });
});
