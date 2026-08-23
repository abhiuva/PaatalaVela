import { describe, expect, it } from "vitest";
import { createShuffleState, nextShuffledSong, previousShuffledSong, queueFingerprint, readShufflePreference, SHUFFLE_STORAGE_KEY } from "@/lib/radio/shuffle";
import type { QueueItem } from "@/lib/radio/queue";

function item(id: string, sequence: number, embedStatus: QueueItem["embedStatus"] = "available"): QueueItem {
  return { id, sequence, embedStatus, title: id, film: "Film", year: 2020, singers: ["Singer"], composer: "Composer", thumbnailUrl: null, story: null, context: null, languageCode: "te", eraCode: "2020s", moods: [], occasions: [], youtubeVideoId: `${id.padEnd(11, "x")}`.slice(0, 11), durationSeconds: 100, assignmentCreatedAt: "2026-01-01T00:00:00Z" };
}
const zero = () => 0;

describe("channel shuffle", () => {
  it("does not mutate the normal ordered queue", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3)];
    const before = JSON.stringify(items);
    nextShuffledSong(createShuffleState("channel", items, "a", zero), "channel", items, "a", zero);
    expect(JSON.stringify(items)).toBe(before);
    expect(items.map((song) => song.id)).toEqual(["a", "b", "c"]);
  });

  it("does not immediately repeat the current song", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3), item("d", 4)];
    const result = nextShuffledSong(createShuffleState("channel", items, "a", zero), "channel", items, "a", zero);
    expect(result.nextId).not.toBe("a");
  });

  it("handles empty, one-song and two-song channels", () => {
    expect(nextShuffledSong(createShuffleState("empty", [], null, zero), "empty", [], null, zero).nextId).toBeNull();
    const one = [item("a", 1)];
    expect(nextShuffledSong(createShuffleState("one", one, "a", zero), "one", one, "a", zero).nextId).toBe("a");
    const two = [item("a", 1), item("b", 2)];
    expect(nextShuffledSong(createShuffleState("two", two, "a", zero), "two", two, "a", zero).nextId).toBe("b");
  });

  it("plays every eligible song before reshuffling and avoids a cycle-boundary repeat", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3), item("d", 4)];
    let state = createShuffleState("channel", items, "a", zero);
    let current = "a";
    const played: string[] = [];
    for (let count = 0; count < 4; count += 1) {
      const result = nextShuffledSong(state, "channel", items, current, zero);
      state = result.state;
      current = result.nextId!;
      played.push(current);
    }
    expect(new Set(played)).toEqual(new Set(["a", "b", "c", "d"]));
    const nextCycle = nextShuffledSong(state, "channel", items, current, zero);
    expect(nextCycle.nextId).not.toBe(current);
  });

  it("rebuilds for a different channel or unavailable catalogue item", () => {
    const first = [item("a", 1), item("b", 2), item("c", 3)];
    const second = [item("x", 1), item("y", 2)];
    const state = nextShuffledSong(createShuffleState("first", first, "a", zero), "first", first, "a", zero).state;
    const switched = nextShuffledSong(state, "second", second, "x", zero);
    expect(["x", "y"]).toContain(switched.nextId);
    expect(switched.state.channelKey).toBe("second");
    const available = first.filter((song) => song.id !== "b");
    const rebuilt = nextShuffledSong(state, "first", available, "a", zero);
    expect(rebuilt.nextId).not.toBe("b");
    expect(rebuilt.state.catalogueFingerprint).toBe(queueFingerprint(available));
  });

  it("supports previous history while enabled", () => {
    const items = [item("a", 1), item("b", 2), item("c", 3)];
    const next = nextShuffledSong(createShuffleState("channel", items, "a", zero), "channel", items, "a", zero);
    expect(previousShuffledSong(next.state, items, next.nextId).previousId).toBe("a");
  });

  it("rejects malformed or incompatible stored preferences", () => {
    const values = new Map([[SHUFFLE_STORAGE_KEY, "not-json"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    expect(readShufflePreference(storage)).toBe(false);
    expect(values.has(SHUFFLE_STORAGE_KEY)).toBe(false);
    values.set(SHUFFLE_STORAGE_KEY, JSON.stringify({ version: 1, enabled: true }));
    expect(readShufflePreference(storage)).toBe(true);
  });
});
