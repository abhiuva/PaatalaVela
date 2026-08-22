/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NowPlaying } from "@/components/NowPlaying";
import type { Channel, Song } from "@/types/radio";

const channel: Channel = { id: "00000000-0000-4000-8000-000000000001", slug: "test", mode: "scheduled", scheduled: true, languageCode: "te", name: "Test", teluguName: "Test", strapline: "Test", mood: "Calm", backgroundImageUrl: null, schedule: { startHour: 5, endHour: 9 }, palette: { from: "#111111", via: "#222222", to: "#333333", accent: "#ffffff" }, songs: [] };
const song: Song = { id: "song", title: "Verified Song", film: "Film", year: 2020, singers: ["Singer"], composer: "Composer", thumbnailUrl: "https://example.com/art.jpg", story: "A short verified story.", context: "Morning listening context.", languageCode: "te", eraCode: "2020s", moods: [], occasions: [], youtubeVideoId: "M7lc1UVf-VE", durationSeconds: 180 };

describe("NowPlaying", () => {
  it("renders the concise public metadata contract", () => {
    render(<NowPlaying channel={channel} song={song} pendingScheduledSwitch={false} />);
    expect(screen.getByRole("heading", { name: "Verified Song" })).toBeInTheDocument();
    expect(screen.getByText("A short verified story.")).toBeInTheDocument();
    expect(screen.getByText("Morning listening context.")).toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
  });
  it("uses the artwork fallback after an image error and omits empty context", () => {
    render(<NowPlaying channel={channel} song={{ ...song, story: null, context: null }} pendingScheduledSwitch={false} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Artwork unavailable")).toBeInTheDocument();
    expect(screen.queryByText("A short verified story.")).not.toBeInTheDocument();
  });
});
