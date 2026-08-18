"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { channels as localChannels } from "@/data/channels";
import { getChannelById, getNextChannel, getScheduledChannel } from "@/lib/schedule";
import { calculateLivePlaybackPosition } from "@/lib/radio/live-position";
import { buildChannelQueue, getNextQueueIndex, type PlaybackMode } from "@/lib/radio/queue";
import { initialPlaybackState, playbackReducer } from "@/lib/radio/playback-state";
import { trackRadioEvent } from "@/lib/radio/analytics";
import type { Channel, ChannelId } from "@/types/radio";

const STORAGE_KEY = "telugu-radio.playback";
const VOLUME_STORAGE_KEY = "telugu-radio.volume";
const MANUAL_EXPIRY_MS = 12 * 60 * 60 * 1000;
const BOUNDARY_GRACE_MS = 15 * 60 * 1000;
const DRIFT_SECONDS = 5;

type StoredPlayback = {
  playbackMode: PlaybackMode;
  selectedManualChannelId: ChannelId | null;
  manualStartedScheduleId: ChannelId | null;
  currentManualSongId: string | null;
  currentManualPosition: number;
  volume: number;
  muted: boolean;
  lastUpdatedAt: number;
};

function readStoredPlayback(): StoredPlayback | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredPlayback>;
    if (!parsed.lastUpdatedAt || Date.now() - parsed.lastUpdatedAt > MANUAL_EXPIRY_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.playbackMode !== "manual" || !parsed.selectedManualChannelId) {
      return null;
    }
    return {
      playbackMode: "manual",
      selectedManualChannelId: parsed.selectedManualChannelId,
      manualStartedScheduleId: typeof parsed.manualStartedScheduleId === "string" ? parsed.manualStartedScheduleId : null,
      currentManualSongId: typeof parsed.currentManualSongId === "string" ? parsed.currentManualSongId : null,
      currentManualPosition: Number.isFinite(parsed.currentManualPosition) ? Math.max(0, Number(parsed.currentManualPosition)) : 0,
      volume: Number.isFinite(parsed.volume) ? Math.min(100, Math.max(0, Number(parsed.volume))) : 70,
      muted: Boolean(parsed.muted),
      lastUpdatedAt: parsed.lastUpdatedAt,
    };
  } catch {
    return null;
  }
}

function readVolume() {
  if (typeof window === "undefined") {
    return 70;
  }

  const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  if (raw === null) {
    return 70;
  }
  const volume = Number(raw);
  return Number.isFinite(volume) && volume >= 0 && volume <= 100 ? volume : 70;
}

function deviceCategory() {
  if (typeof window === "undefined") {
    return "desktop";
  }
  if (window.innerWidth < 640) {
    return "mobile";
  }
  if (window.innerWidth < 1024) {
    return "tablet";
  }
  return "desktop";
}

function findPlayableChannel(channels: Channel[], preferred: Channel, mode: PlaybackMode) {
  const preferredQueue = buildChannelQueue(preferred, mode);
  if (preferredQueue.items.length > 0) {
    return { channel: preferred, queue: preferredQueue, fallbackReason: null };
  }

  for (const candidate of channels) {
    const queue = buildChannelQueue(candidate, mode);
    if (queue.items.length > 0) {
      return {
        channel: candidate,
        queue,
        fallbackReason: `${preferred.name} is temporarily unavailable. Using ${candidate.name}.`,
      };
    }
  }

  return { channel: preferred, queue: preferredQueue, fallbackReason: `${preferred.name} is temporarily unavailable.` };
}

export function useRadioPlayer(now: Date, availableChannels: Channel[] = localChannels) {
  const scheduledChannel = useMemo(() => getScheduledChannel(now, availableChannels), [availableChannels, now]);
  const [playbackState, dispatch] = useReducer(playbackReducer, initialPlaybackState);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("live");
  const [listenerOffset, setListenerOffset] = useState(false);
  const [manualStartedScheduleId, setManualStartedScheduleId] = useState<ChannelId | null>(null);
  const [channelId, setChannelId] = useState<ChannelId>(scheduledChannel.id);
  const [trackIndex, setTrackIndex] = useState(0);
  const [seekSeconds, setSeekSeconds] = useState(0);
  const [seekRevision, setSeekRevision] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [boundaryStartedAt, setBoundaryStartedAt] = useState<number | null>(null);
  const currentPositionRef = useRef(0);
  const lastEndedSongIdRef = useRef<string | null>(null);
  const failedSongIdsRef = useRef<Set<string>>(new Set());
  const lastLiveSyncKeyRef = useRef<string | null>(null);

  const selectedChannel = useMemo(() => getChannelById(channelId, availableChannels), [availableChannels, channelId]);
  const queueMode = playbackMode === "manual" ? "manual" : "live";
  const activeQueue = useMemo(() => buildChannelQueue(selectedChannel, queueMode), [queueMode, selectedChannel]);
  const song = activeQueue.items[trackIndex] ?? activeQueue.items[0] ?? selectedChannel.songs[0];
  const nextChannel = useMemo(() => getNextChannel(selectedChannel.id, availableChannels), [availableChannels, selectedChannel.id]);
  const pendingScheduledSwitch = playbackMode === "live" && scheduledChannel.id !== selectedChannel.id;

  const syncToLive = useCallback(
    (reason: "initial" | "return" | "boundary" | "visibility" | "error") => {
      const playable = findPlayableChannel(availableChannels, scheduledChannel, "live");
      const livePosition =
        playable.queue.items.length > 0
          ? calculateLivePlaybackPosition({
              currentTime: new Date(),
              channelStartHour: playable.channel.schedule.startHour,
              songs: playable.queue.items,
            })
          : null;

      setPlaybackMode("live");
      setManualStartedScheduleId(null);
      setListenerOffset(false);
      setChannelId(playable.channel.id);
      setTrackIndex(livePosition?.songIndex ?? 0);
      setSeekSeconds(livePosition?.seekSeconds ?? 0);
      setSeekRevision((current) => current + 1);
      setFallbackReason(playable.fallbackReason);
      setBoundaryStartedAt(null);
      failedSongIdsRef.current = new Set();
      dispatch({ type: "RETURN_TO_LIVE", songId: livePosition?.songId ?? null });
      trackRadioEvent(reason === "return" ? "returned_to_live" : "live_position_calculated", {
        channel_id: playable.channel.id,
        drift_seconds: 0,
      });
    },
    [availableChannels, scheduledChannel],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = readStoredPlayback();
      setVolume(stored?.volume ?? readVolume());
      if (stored?.playbackMode === "manual" && stored.selectedManualChannelId) {
        const channel = availableChannels.find((item) => item.id === stored.selectedManualChannelId);
        if (channel) {
          const queue = buildChannelQueue(channel, "manual");
          const restoredIndex = Math.max(0, queue.items.findIndex((item) => item.id === stored.currentManualSongId));
          setPlaybackMode("manual");
          setManualStartedScheduleId(stored.manualStartedScheduleId ?? scheduledChannel.id);
          setChannelId(channel.id);
          setTrackIndex(restoredIndex === -1 ? 0 : restoredIndex);
          setSeekSeconds(stored.currentManualPosition);
          setSeekRevision((current) => current + 1);
          return;
        }
      }
      syncToLive("initial");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [availableChannels, scheduledChannel.id, syncToLive]);

  useEffect(() => {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    if (playbackMode !== "manual" || !song) {
      return;
    }

    const payload: StoredPlayback = {
      playbackMode: "manual",
      selectedManualChannelId: selectedChannel.id,
      manualStartedScheduleId,
      currentManualSongId: song.id,
      currentManualPosition: currentPositionRef.current,
      volume,
      muted: volume === 0,
      lastUpdatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [manualStartedScheduleId, playbackMode, selectedChannel.id, song, volume, seekRevision]);

  useEffect(() => {
    if (playbackMode === "manual" && manualStartedScheduleId && scheduledChannel.id !== manualStartedScheduleId) {
      const timeout = window.setTimeout(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setManualStartedScheduleId(null);
        syncToLive("boundary");
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    if (playbackMode === "live" && scheduledChannel.id !== selectedChannel.id && !boundaryStartedAt) {
      const timeout = window.setTimeout(() => {
        setBoundaryStartedAt(Date.now());
        dispatch({ type: "SCHEDULE_BOUNDARY" });
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [boundaryStartedAt, manualStartedScheduleId, playbackMode, scheduledChannel.id, selectedChannel.id, syncToLive]);

  useEffect(() => {
    if (!boundaryStartedAt || !pendingScheduledSwitch) {
      return;
    }

    if (Date.now() - boundaryStartedAt > BOUNDARY_GRACE_MS) {
      const timeout = window.setTimeout(() => syncToLive("boundary"), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [boundaryStartedAt, pendingScheduledSwitch, now, syncToLive]);

  useEffect(() => {
    const syncKey = `${playbackMode}:${scheduledChannel.id}:${availableChannels.map((channel) => `${channel.id}:${channel.songs.length}`).join("|")}`;
    if (playbackMode === "live" && !listenerOffset && lastLiveSyncKeyRef.current !== syncKey) {
      lastLiveSyncKeyRef.current = syncKey;
      const timeout = window.setTimeout(() => syncToLive("initial"), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [availableChannels, listenerOffset, playbackMode, scheduledChannel.id, syncToLive]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || playbackMode !== "live" || listenerOffset) {
        return;
      }

      const playable = findPlayableChannel(availableChannels, scheduledChannel, "live");
      if (playable.queue.items.length === 0) {
        return;
      }
      const livePosition = calculateLivePlaybackPosition({
        currentTime: new Date(),
        channelStartHour: playable.channel.schedule.startHour,
        songs: playable.queue.items,
      });
      const currentSong = playable.queue.items[livePosition.songIndex];
      const drift = currentSong?.id === song?.id ? Math.abs(livePosition.seekSeconds - currentPositionRef.current) : Number.POSITIVE_INFINITY;
      if (drift > DRIFT_SECONDS) {
        syncToLive("visibility");
        trackRadioEvent("playback_resynchronised", { channel_id: selectedChannel.id, drift_seconds: Math.round(drift) });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [availableChannels, listenerOffset, playbackMode, scheduledChannel, selectedChannel.id, song?.id, syncToLive]);

  const loadIndex = useCallback(
    (index: number, nextSeekSeconds = 0) => {
      const boundedIndex = activeQueue.items.length > 0 ? ((index % activeQueue.items.length) + activeQueue.items.length) % activeQueue.items.length : 0;
      setTrackIndex(boundedIndex);
      setSeekSeconds(nextSeekSeconds);
      setSeekRevision((current) => current + 1);
      lastEndedSongIdRef.current = null;
      dispatch({ type: "NEXT", songId: activeQueue.items[boundedIndex]?.id ?? "" });
      trackRadioEvent("song_started", {
        song_id: activeQueue.items[boundedIndex]?.id ?? "song_unknown",
        channel_id: selectedChannel.id,
        playback_mode: playbackMode,
        sequence: activeQueue.items[boundedIndex]?.sequence ?? 0,
        started_from_seconds: nextSeekSeconds,
      });
    },
    [activeQueue.items, playbackMode, selectedChannel.id],
  );

  const selectChannel = useCallback(
    (nextChannelId: ChannelId) => {
      const nextChannel = getChannelById(nextChannelId, availableChannels);
      const nextQueue = buildChannelQueue(nextChannel, "manual");
      window.localStorage.removeItem(STORAGE_KEY);
      setHasUserInteracted(true);
      setPlaybackMode("manual");
      setManualStartedScheduleId(scheduledChannel.id);
      setListenerOffset(false);
      setChannelId(nextChannelId);
      setTrackIndex(0);
      setSeekSeconds(0);
      setSeekRevision((current) => current + 1);
      failedSongIdsRef.current = new Set();
      dispatch({ type: "CHANNEL_CHANGED", songId: nextQueue.items[0]?.id ?? null });
      trackRadioEvent("channel_changed", {
        previous_channel_id: selectedChannel.id,
        selected_channel_id: nextChannelId,
        reason: "manual",
        playback_mode: "manual",
      });
      trackRadioEvent("manual_mode_started", { channel_id: nextChannelId });
    },
    [availableChannels, scheduledChannel.id, selectedChannel.id],
  );

  const resumeSchedule = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setManualStartedScheduleId(null);
    syncToLive("return");
  }, [syncToLive]);

  const togglePlayback = useCallback(() => {
    setHasUserInteracted(true);
    setIsPlaying((current) => {
      dispatch({ type: current ? "PAUSE" : "PLAY" });
      if (current) {
        trackRadioEvent("radio_paused", { channel_id: selectedChannel.id, listened_seconds: Math.round(currentPositionRef.current) });
      } else {
        trackRadioEvent("radio_started", {
          playback_mode: playbackMode,
          channel_id: selectedChannel.id,
          scheduled_channel_id: scheduledChannel.id,
          source: "local",
          device_category: deviceCategory(),
        });
      }
      return !current;
    });
  }, [playbackMode, scheduledChannel.id, selectedChannel.id]);

  const moveTrack = useCallback(
    (direction: 1 | -1) => {
      setHasUserInteracted(true);
      if (playbackMode === "live") {
        setListenerOffset(true);
      }
      failedSongIdsRef.current = new Set();
      const nextIndex = getNextQueueIndex(activeQueue.items.length, trackIndex, direction);
      dispatch({ type: direction === 1 ? "NEXT" : "PREVIOUS", songId: activeQueue.items[nextIndex]?.id ?? "" });
      loadIndex(nextIndex, 0);
    },
    [activeQueue.items, loadIndex, playbackMode, trackIndex],
  );

  const nextTrack = useCallback(() => moveTrack(1), [moveTrack]);
  const previousTrack = useCallback(() => moveTrack(-1), [moveTrack]);

  const handleEnded = useCallback(() => {
    if (!song || lastEndedSongIdRef.current === song.id) {
      return;
    }

    lastEndedSongIdRef.current = song.id;
    dispatch({ type: "SONG_ENDED", songId: song.id });
    trackRadioEvent("song_completed", {
      song_id: song.id,
      channel_id: selectedChannel.id,
      listened_seconds: Math.min(currentPositionRef.current || song.durationSeconds, song.durationSeconds),
      completion_percent: Math.min(100, Math.round(((currentPositionRef.current || song.durationSeconds) / song.durationSeconds) * 100)),
    });

    if (pendingScheduledSwitch) {
      syncToLive("boundary");
      return;
    }

    loadIndex(getNextQueueIndex(activeQueue.items.length, trackIndex, 1), 0);
  }, [activeQueue.items.length, loadIndex, pendingScheduledSwitch, selectedChannel.id, song, syncToLive, trackIndex]);

  const handlePlayerError = useCallback(() => {
    if (!song) {
      return;
    }

    failedSongIdsRef.current.add(song.id);
    const exhausted = failedSongIdsRef.current.size >= activeQueue.items.length;
    dispatch({ type: "PLAYER_ERROR", songId: song.id, exhausted });
    trackRadioEvent("player_error", {
      song_id: song.id,
      channel_id: selectedChannel.id,
      youtube_error_category: "unknown",
      recovery_success: !exhausted,
    });

    if (exhausted) {
      setIsPlaying(false);
      return;
    }

    let offset = 1;
    while (offset <= activeQueue.items.length) {
      const candidateIndex = getNextQueueIndex(activeQueue.items.length, trackIndex + offset - 1, 1);
      const candidate = activeQueue.items[candidateIndex];
      if (candidate && !failedSongIdsRef.current.has(candidate.id)) {
        trackRadioEvent("song_skipped", {
          song_id: song.id,
          channel_id: selectedChannel.id,
          reason: "player_error",
          listened_seconds: currentPositionRef.current,
        });
        loadIndex(candidateIndex, 0);
        break;
      }
      offset += 1;
    }
  }, [activeQueue.items, loadIndex, selectedChannel.id, song, trackIndex]);

  const handlePlayerReady = useCallback(() => {
    dispatch({ type: "PLAYER_READY" });
  }, []);

  const handlePositionChange = useCallback(
    (positionSeconds: number) => {
      currentPositionRef.current = positionSeconds;
      if (playbackMode !== "manual" || !song) {
        return;
      }
      const existing = readStoredPlayback();
      if (existing?.selectedManualChannelId === selectedChannel.id) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...existing,
            currentManualSongId: song.id,
            manualStartedScheduleId: existing.manualStartedScheduleId,
            currentManualPosition: positionSeconds,
            volume,
            muted: volume === 0,
            lastUpdatedAt: Date.now(),
          }),
        );
      }
    },
    [playbackMode, selectedChannel.id, song, volume],
  );

  return {
    channels: availableChannels,
    channel: selectedChannel,
    scheduledChannel,
    nextChannel,
    song,
    queue: activeQueue,
    trackIndex,
    seekSeconds,
    seekRevision,
    isPlaying,
    hasUserInteracted,
    volume,
    playbackMode,
    playbackStatus: playbackState.status,
    manualChannelId: playbackMode === "manual" ? selectedChannel.id : null,
    listenerOffset,
    pendingScheduledSwitch,
    fallbackReason,
    setVolume,
    selectChannel,
    resumeSchedule,
    togglePlayback,
    nextTrack,
    previousTrack,
    handleEnded,
    handlePlayerError,
    handlePlayerReady,
    handlePositionChange,
  };
}
