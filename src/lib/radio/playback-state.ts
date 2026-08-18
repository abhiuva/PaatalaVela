export type PlaybackStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "transitioning" | "error" | "exhausted";

export type PlaybackState = {
  status: PlaybackStatus;
  currentSongId: string | null;
  lastEndedSongId: string | null;
  failedSongIds: readonly string[];
};

export type PlaybackEvent =
  | { type: "START" }
  | { type: "PLAYER_READY" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SONG_ENDED"; songId: string }
  | { type: "NEXT"; songId: string }
  | { type: "PREVIOUS"; songId: string }
  | { type: "CHANNEL_CHANGED"; songId: string | null }
  | { type: "SCHEDULE_BOUNDARY" }
  | { type: "PLAYER_ERROR"; songId: string; exhausted: boolean }
  | { type: "RETURN_TO_LIVE"; songId: string | null }
  | { type: "RETRY" };

export const initialPlaybackState: PlaybackState = {
  status: "idle",
  currentSongId: null,
  lastEndedSongId: null,
  failedSongIds: [],
};

export function playbackReducer(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case "START":
      return { ...state, status: "loading" };
    case "PLAYER_READY":
      return { ...state, status: "ready" };
    case "PLAY":
      return { ...state, status: "playing" };
    case "PAUSE":
      return { ...state, status: "paused" };
    case "SONG_ENDED":
      if (state.lastEndedSongId === event.songId) {
        return state;
      }
      return { ...state, status: "transitioning", lastEndedSongId: event.songId };
    case "NEXT":
    case "PREVIOUS":
      return { ...state, status: "transitioning", currentSongId: event.songId, lastEndedSongId: null };
    case "CHANNEL_CHANGED":
    case "RETURN_TO_LIVE":
      return { ...state, status: "loading", currentSongId: event.songId, lastEndedSongId: null, failedSongIds: [] };
    case "SCHEDULE_BOUNDARY":
      return { ...state, status: state.status === "playing" ? "playing" : "transitioning" };
    case "PLAYER_ERROR": {
      const failedSongIds = state.failedSongIds.includes(event.songId) ? state.failedSongIds : [...state.failedSongIds, event.songId];
      return { ...state, status: event.exhausted ? "exhausted" : "error", failedSongIds };
    }
    case "RETRY":
      return { ...state, status: "loading" };
    default:
      return state;
  }
}
