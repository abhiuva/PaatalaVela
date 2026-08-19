export type ChannelSlug =
  | "suprabhata-melodies"
  | "tea-shop-classics"
  | "ilaiyaraaja-era"
  | "prema-viraham"
  | "mass-beat-centre"
  | "highway-ratri"
  | "english-hits";

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
  scheduled: boolean;
  name: string;
  teluguName: string;
  strapline: string;
  mood: string;
  schedule: TimeRange;
  palette: {
    from: string;
    via: string;
    to: string;
    accent: string;
  };
  songs: Song[];
};
