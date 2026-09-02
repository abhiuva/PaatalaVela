"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerVisibilitySnapshot, YTPlayer, YouTubePlayerStateChangeEvent } from "@/types/youtube";

type YouTubePlayerProps = {
  queueEntryId: string | null;
  videoId: string | null;
  isPlaying: boolean;
  hasUserInteracted: boolean;
  volume: number;
  seekSeconds: number;
  seekRevision: number;
  onReady: () => void;
  onPlaybackStarted: (videoId: string) => void;
  onAutoplayBlocked: () => void;
  onResumeBlocked: () => void;
  onVisibilityResume: (snapshot: PlayerVisibilitySnapshot) => boolean;
  onEnded: () => void;
  onError: (code: number) => void;
  onPositionChange: (positionSeconds: number) => void;
};

const PLAYER_ELEMENT_ID = "telugu-radio-youtube-player";
const PLAY_CONFIRMATION_MS = 3000;
const SEEK_TOLERANCE_SECONDS = 1;
const RESUME_EVENT_DEDUP_MS = 750;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export function YouTubePlayer(props: YouTubePlayerProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const latestRef = useRef(props);
  const loadedRequestKeyRef = useRef<string | null>(null);
  const appliedSeekRevisionRef = useRef<number | null>(null);
  const confirmationTimerRef = useRef<number | null>(null);
  const loadStartedPlaybackRef = useRef(false);
  const resumeAttemptPendingRef = useRef(false);
  const lastResumeCheckRef = useRef(Number.NEGATIVE_INFINITY);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    latestRef.current = props;
  }, [props]);

  const clearConfirmationTimer = useCallback(() => {
    if (confirmationTimerRef.current !== null) {
      window.clearTimeout(confirmationTimerRef.current);
      confirmationTimerRef.current = null;
    }
  }, []);

  const expectPlayback = useCallback((reason: "start" | "resume" = "start") => {
    clearConfirmationTimer();
    confirmationTimerRef.current = window.setTimeout(() => {
      confirmationTimerRef.current = null;
      resumeAttemptPendingRef.current = false;
      if (reason === "resume") latestRef.current.onResumeBlocked();
      else latestRef.current.onAutoplayBlocked();
    }, PLAY_CONFIRMATION_MS);
  }, [clearConfirmationTimer]);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || playerRef.current || !window.YT?.Player) return;
      const initialVideoId = latestRef.current.videoId;
      playerRef.current = new window.YT.Player(PLAYER_ELEMENT_ID, {
        ...(initialVideoId ? { videoId: initialVideoId } : {}),
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: (event) => {
            const latest = latestRef.current;
            event.target.setVolume(latest.volume);
            setIsReady(true);
            latest.onReady();
          },
          onStateChange: (event: YouTubePlayerStateChangeEvent) => {
            const playerState = window.YT?.PlayerState;
            if (event.data === playerState?.PLAYING) {
              clearConfirmationTimer();
              resumeAttemptPendingRef.current = false;
              const currentVideoId = latestRef.current.videoId;
              if (currentVideoId) latestRef.current.onPlaybackStarted(currentVideoId);
            } else if (event.data === playerState?.ENDED) {
              clearConfirmationTimer();
              const endedVideoId = event.target.getVideoData?.().video_id;
              if (endedVideoId && endedVideoId !== latestRef.current.videoId) return;
              latestRef.current.onEnded();
            }
          },
          onError: (event) => {
            clearConfirmationTimer();
            latestRef.current.onError(event.data);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      clearConfirmationTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [clearConfirmationTimer]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady) return;
    if (!props.videoId) {
      clearConfirmationTimer();
      if (loadedRequestKeyRef.current !== null) player.stopVideo();
      loadedRequestKeyRef.current = null;
      appliedSeekRevisionRef.current = null;
      return;
    }
    const requestKey = `${props.queueEntryId ?? "unassigned"}:${props.videoId}`;
    const isDifferentEntry = loadedRequestKeyRef.current !== requestKey;
    const isNewSeekRequest = appliedSeekRevisionRef.current !== props.seekRevision;

    if (isDifferentEntry) {
      loadedRequestKeyRef.current = requestKey;
      appliedSeekRevisionRef.current = props.seekRevision;
      if (props.hasUserInteracted && props.isPlaying) {
        loadStartedPlaybackRef.current = true;
        player.loadVideoById(props.videoId);
        expectPlayback();
      } else {
        player.cueVideoById(props.videoId);
      }
      player.seekTo(props.seekSeconds, true);
      return;
    }

    if (isNewSeekRequest) {
      appliedSeekRevisionRef.current = props.seekRevision;
      const currentPosition = player.getCurrentTime();
      if (Math.abs(currentPosition - props.seekSeconds) >= SEEK_TOLERANCE_SECONDS) {
        player.seekTo(props.seekSeconds, true);
      }
      if (props.hasUserInteracted && props.isPlaying && player.getPlayerState?.() === window.YT?.PlayerState.ENDED) {
        loadStartedPlaybackRef.current = true;
        player.playVideo();
        expectPlayback();
      }
    }
  }, [clearConfirmationTimer, expectPlayback, isReady, props.hasUserInteracted, props.isPlaying, props.queueEntryId, props.seekRevision, props.seekSeconds, props.videoId]);

  useEffect(() => {
    playerRef.current?.setVolume(props.volume);
  }, [props.volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady || !props.hasUserInteracted || !props.videoId) return;
    if (props.isPlaying) {
      if (loadStartedPlaybackRef.current) {
        loadStartedPlaybackRef.current = false;
        return;
      }
      if (player.getPlayerState?.() !== window.YT?.PlayerState.PLAYING) {
        player.playVideo();
        expectPlayback();
      }
    } else {
      clearConfirmationTimer();
      if (player.getPlayerState?.() !== window.YT?.PlayerState.PAUSED) player.pauseVideo();
    }
  }, [clearConfirmationTimer, expectPlayback, isReady, props.hasUserInteracted, props.isPlaying, props.seekRevision, props.videoId]);

  useEffect(() => {
    const reconcileAfterResume = () => {
      if (document.visibilityState !== "visible") return;
      const timestamp = performance.now();
      if (timestamp - lastResumeCheckRef.current < RESUME_EVENT_DEDUP_MS) return;
      lastResumeCheckRef.current = timestamp;
      const player = playerRef.current;
      const latest = latestRef.current;
      if (!player || !latest.videoId) return;
      const playerState = player.getPlayerState?.() ?? null;
      const currentEntryIsAuthoritative = latest.onVisibilityResume({
        queueEntryId: latest.queueEntryId,
        videoId: player.getVideoData?.().video_id ?? latest.videoId,
        positionSeconds: player.getCurrentTime(),
        playerState,
      });
      if (!currentEntryIsAuthoritative || !latest.hasUserInteracted || !latest.isPlaying || playerState === window.YT?.PlayerState.PLAYING || resumeAttemptPendingRef.current) return;
      resumeAttemptPendingRef.current = true;
      player.playVideo();
      expectPlayback("resume");
    };

    document.addEventListener("visibilitychange", reconcileAfterResume);
    window.addEventListener("pageshow", reconcileAfterResume);
    document.addEventListener("resume", reconcileAfterResume);
    return () => {
      document.removeEventListener("visibilitychange", reconcileAfterResume);
      window.removeEventListener("pageshow", reconcileAfterResume);
      document.removeEventListener("resume", reconcileAfterResume);
    };
  }, [expectPlayback]);

  useEffect(() => {
    if (!isReady || !props.isPlaying) return;
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (player) latestRef.current.onPositionChange(player.getCurrentTime());
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isReady, props.isPlaying]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/20 bg-black shadow-2xl shadow-black/30">
      <div className="aspect-video w-full">
        <div id={PLAYER_ELEMENT_ID} className="h-full w-full" title="YouTube radio player" />
      </div>
    </div>
  );
}
