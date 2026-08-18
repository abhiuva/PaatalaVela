import { describe, expect, it } from "vitest";
import { initialPlaybackState, playbackReducer } from "@/lib/radio/playback-state";

describe("playbackReducer", () => {
  it("does not transition twice for duplicate ended events", () => {
    const once = playbackReducer(initialPlaybackState, { type: "SONG_ENDED", songId: "a" });
    const twice = playbackReducer(once, { type: "SONG_ENDED", songId: "a" });
    expect(twice).toBe(once);
  });

  it("tracks player errors without duplicate failed song IDs", () => {
    const once = playbackReducer(initialPlaybackState, { type: "PLAYER_ERROR", songId: "a", exhausted: false });
    const twice = playbackReducer(once, { type: "PLAYER_ERROR", songId: "a", exhausted: false });
    expect(twice.failedSongIds).toEqual(["a"]);
  });

  it("sets exhausted state when the queue is exhausted", () => {
    const state = playbackReducer(initialPlaybackState, { type: "PLAYER_ERROR", songId: "a", exhausted: true });
    expect(state.status).toBe("exhausted");
  });
});
