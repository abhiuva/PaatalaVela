"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { YTPlayer, YouTubePlayerStateChangeEvent } from "@/types/youtube";

type YouTubePlayerProps = {
  videoId: string | null;
  isPlaying: boolean;
  hasUserInteracted: boolean;
  volume: number;
  seekSeconds: number;
  seekRevision: number;
  onReady: () => void;
  onPlaybackStarted: (videoId: string) => void;
  onAutoplayBlocked: () => void;
  onEnded: () => void;
  onError: (code: number) => void;
  onPositionChange: (positionSeconds: number) => void;
};

const PLAYER_ELEMENT_ID = "telugu-radio-youtube-player";
const PLAY_CONFIRMATION_MS = 3000;

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
  const loadedKeyRef = useRef<string | null>(null);
  const confirmationTimerRef = useRef<number | null>(null);
  const loadStartedPlaybackRef = useRef(false);
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

  const expectPlayback = useCallback(() => {
    clearConfirmationTimer();
    confirmationTimerRef.current = window.setTimeout(() => {
      confirmationTimerRef.current = null;
      latestRef.current.onAutoplayBlocked();
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
            if (latest.videoId) {
              event.target.cueVideoById(latest.videoId);
              event.target.seekTo(latest.seekSeconds, true);
            }
            setIsReady(true);
            latest.onReady();
          },
          onStateChange: (event: YouTubePlayerStateChangeEvent) => {
            const playerState = window.YT?.PlayerState;
            if (event.data === playerState?.PLAYING) {
              clearConfirmationTimer();
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
      loadedKeyRef.current = null;
      player.stopVideo();
      return;
    }
    const loadKey = `${props.videoId}:${props.seekRevision}`;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;
    if (props.hasUserInteracted && props.isPlaying) {
      loadStartedPlaybackRef.current = true;
      player.loadVideoById(props.videoId);
      player.seekTo(props.seekSeconds, true);
      expectPlayback();
    } else {
      player.cueVideoById(props.videoId);
      player.seekTo(props.seekSeconds, true);
    }
  }, [clearConfirmationTimer, expectPlayback, isReady, props.hasUserInteracted, props.isPlaying, props.seekRevision, props.seekSeconds, props.videoId]);

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
      player.playVideo();
      expectPlayback();
    } else {
      clearConfirmationTimer();
      player.pauseVideo();
    }
  }, [clearConfirmationTimer, expectPlayback, isReady, props.hasUserInteracted, props.isPlaying, props.videoId]);

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
