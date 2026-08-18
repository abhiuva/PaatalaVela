"use client";

import { useEffect, useRef, useState } from "react";
import type { YTPlayer, YouTubePlayerStateChangeEvent } from "@/types/youtube";

type YouTubePlayerProps = {
  videoId: string;
  isPlaying: boolean;
  hasUserInteracted: boolean;
  volume: number;
  seekSeconds: number;
  seekRevision: number;
  onReady: () => void;
  onEnded: () => void;
  onError: () => void;
  onPositionChange: (positionSeconds: number) => void;
};

const PLAYER_ELEMENT_ID = "telugu-radio-youtube-player";

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

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

export function YouTubePlayer({
  videoId,
  isPlaying,
  hasUserInteracted,
  volume,
  seekSeconds,
  seekRevision,
  onReady,
  onEnded,
  onError,
  onPositionChange,
}: YouTubePlayerProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const latestVideoId = useRef(videoId);
  const loadedKeyRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    latestVideoId.current = videoId;
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || playerRef.current || !window.YT?.Player) {
        return;
      }

      playerRef.current = new window.YT.Player(PLAYER_ELEMENT_ID, {
        videoId: latestVideoId.current,
        playerVars: {
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(volume);
            event.target.cueVideoById(latestVideoId.current);
            event.target.seekTo(seekSeconds, true);
            setIsReady(true);
            onReady();
          },
          onStateChange: (event: YouTubePlayerStateChangeEvent) => {
            if (event.data === window.YT?.PlayerState.ENDED) {
              onEnded();
            }
          },
          onError: () => {
            onError();
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [onEnded, onError, onReady, seekSeconds, volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady) {
      return;
    }

    const loadKey = `${videoId}:${seekRevision}`;
    if (loadedKeyRef.current === loadKey) {
      return;
    }

    loadedKeyRef.current = loadKey;

    if (hasUserInteracted && isPlaying) {
      player.loadVideoById(videoId);
      player.seekTo(seekSeconds, true);
      player.playVideo();
    } else {
      player.cueVideoById(videoId);
      player.seekTo(seekSeconds, true);
    }
  }, [hasUserInteracted, isPlaying, isReady, seekRevision, seekSeconds, videoId]);

  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady || !hasUserInteracted) {
      return;
    }

    if (isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [hasUserInteracted, isPlaying, isReady]);

  useEffect(() => {
    if (!isReady || !isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (player) {
        onPositionChange(player.getCurrentTime());
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isPlaying, isReady, onPositionChange]);

  return (
    <div className="overflow-hidden rounded-lg border border-white/20 bg-black shadow-2xl shadow-black/30">
      <div className="aspect-video w-full">
        <div id={PLAYER_ELEMENT_ID} className="h-full w-full" title="YouTube radio player" />
      </div>
    </div>
  );
}
