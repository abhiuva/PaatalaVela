export type YouTubePlayerStateChangeEvent = {
  data: number;
  target: YTPlayer;
};

export type YouTubePlayerErrorEvent = {
  data: number;
  target: YTPlayer;
};

export type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

export type YTConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady: (event: { target: YTPlayer }) => void;
      onStateChange: (event: YouTubePlayerStateChangeEvent) => void;
      onError: (event: YouTubePlayerErrorEvent) => void;
    };
  },
) => YTPlayer;

declare global {
  interface Window {
    YT?: {
      Player: YTConstructor;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
