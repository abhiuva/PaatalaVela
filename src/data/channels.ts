import type { Channel, Song } from "@/types/radio";

const placeholderIds = ["dQw4w9WgXcQ", "M7lc1UVf-VE", "ScMzIvxBSi4", "ysz5S6PUM-U", "aqz-KE-bpKQ"];
const durations = [213, 186, 242, 205, 231];

function sampleSong(prefix: string, index: number, title: string, year: number): Song {
  return {
    id: `${prefix}-${index}`,
    title: `${title} Placeholder ${index}`,
    film: "Replace With Film",
    year,
    singers: ["Replace Singer"],
    composer: "Replace Composer",
    youtubeVideoId: placeholderIds[index - 1],
    durationSeconds: durations[index - 1],
    sequence: index * 10,
    assignmentCreatedAt: `2026-08-15T00:00:0${index}.000Z`,
    active: true,
    embedStatus: "available",
    placeholder: true,
  };
}

export const channels: Channel[] = [
  {
    id: "suprabhata-melodies",
    name: "Suprabhata Melodies",
    teluguName: "సుప్రభాత మాధుర్యాలు",
    strapline: "Temple bells, soft strings and sunrise voices.",
    mood: "Dawn devotional courtyard",
    schedule: { startHour: 5, endHour: 9 },
    palette: { from: "#5d2f0d", via: "#c67122", to: "#f5d17d", accent: "#ffd166" },
    songs: [1, 2, 3, 4, 5].map((index) => sampleSong("sm", index, "Suprabhata", 1989 + index)),
  },
  {
    id: "tea-shop-classics",
    name: "Tea Shop Classics",
    teluguName: "టీ షాప్ క్లాసిక్స్",
    strapline: "Brass tumblers, roadside chatter and evergreen hooks.",
    mood: "Busy morning bazaar",
    schedule: { startHour: 9, endHour: 13 },
    palette: { from: "#243b2f", via: "#8d5b2f", to: "#e0a64f", accent: "#7bd389" },
    songs: [1, 2, 3, 4, 5].map((index) => sampleSong("tc", index, "Tea Shop", 1977 + index * 2)),
  },
  {
    id: "ilaiyaraaja-era",
    name: "Ilaiyaraaja Era",
    teluguName: "ఇళయరాజా యుగం",
    strapline: "Analog warmth, village winds and orchestral pulse.",
    mood: "Golden studio afternoon",
    schedule: { startHour: 13, endHour: 17 },
    palette: { from: "#143d4c", via: "#3d6d68", to: "#c8b56a", accent: "#f4d35e" },
    songs: [1, 2, 3, 4, 5].map((index) => sampleSong("ir", index, "Ilaiyaraaja Era", 1981 + index * 2)),
  },
  {
    id: "prema-viraham",
    name: "Prema & Viraham",
    teluguName: "ప్రేమ & విరహం",
    strapline: "Evening rain, letters, longing and luminous refrains.",
    mood: "Monsoon romance evening",
    schedule: { startHour: 17, endHour: 21 },
    palette: { from: "#251f47", via: "#6e315f", to: "#cc6b8e", accent: "#f7a8b8" },
    songs: [1, 2, 3, 4, 5].map((index) => sampleSong("pv", index, "Prema Viraham", 1996 + index * 2)),
  },
  {
    id: "mass-beat-centre",
    name: "Mass Beat Centre",
    teluguName: "మాస్ బీట్ సెంటర్",
    strapline: "Festival lights, dappu hits and theatre-first energy.",
    mood: "Night street celebration",
    schedule: { startHour: 21, endHour: 23 },
    palette: { from: "#1d1b1b", via: "#a02c2c", to: "#f2b705", accent: "#ff4d4d" },
    songs: [1, 2, 3, 4, 5].map((index) => sampleSong("mb", index, "Mass Beat", 2007 + index * 2)),
  },
  {
    id: "highway-ratri",
    name: "Highway Ratri",
    teluguName: "హైవే రాత్రి",
    strapline: "Late-night roads, sodium lamps and steady cruising songs.",
    mood: "Midnight highway",
    schedule: { startHour: 23, endHour: 5 },
    palette: { from: "#050712", via: "#12324a", to: "#396d7d", accent: "#8be9fd" },
    songs: [1, 2, 3, 4, 5].map((index) => sampleSong("hr", index, "Highway Ratri", 1994 + index * 3)),
  },
];
