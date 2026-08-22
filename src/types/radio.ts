export type ChannelSlug = string;
export type ChannelMode = "scheduled" | "on_demand";

export type TimeRange = {
  startHour: number;
  endHour: number;
};

export type Song = {
  id: string;
  title: string;
  film: string;
  year: number;
  singers: string[];
  composer: string;
  thumbnailUrl: string | null;
  story: string | null;
  context: string | null;
  languageCode: string;
  eraCode: string;
  moods: string[];
  occasions: string[];
  youtubeVideoId: string;
  durationSeconds: number | null;
  sequence?: number;
  assignmentCreatedAt?: string;
  active?: boolean;
  embedStatus?: "unchecked" | "available" | "unavailable" | "embedding_disabled" | "region_restricted";
};

export type Channel = {
  id: string | null;
  slug: ChannelSlug;
  mode: ChannelMode;
  scheduled: boolean;
  languageCode: string;
  name: string;
  teluguName: string;
  strapline: string;
  mood: string;
  backgroundImageUrl: string | null;
  schedule: TimeRange;
  palette: {
    from: string;
    via: string;
    to: string;
    accent: string;
  };
  songs: Song[];
};
