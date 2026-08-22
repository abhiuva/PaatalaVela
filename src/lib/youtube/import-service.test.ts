import { describe, expect, it, vi } from "vitest";
import { createSongWithAssignment } from "@/lib/youtube/import-service";

const ENGLISH_CHANNEL_ID = "6f3fc628-a517-4dc5-a479-334d6bce7558";
const SONG_ID = "b7657310-9979-419a-b5b8-a46c62e5da91";

describe("YouTube import assignment", () => {
  it("creates one verified song and assigns it to English Hits by UUID", async () => {
    const songInsert = vi.fn().mockReturnValue({
      select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: SONG_ID }, error: null }) }),
    });
    const assignmentInsert = vi.fn().mockResolvedValue({ error: null });
    const service = {
      from(table: string) {
        if (table === "songs") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
            insert: songInsert,
            delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        return { insert: assignmentInsert };
      },
    };

    const result = await createSongWithAssignment(service as never, {
      metadata: {
        youtubeVideoId: "M7lc1UVf-VE",
        youtubeUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
        title: "Verified English Song",
        description: "Official metadata",
        thumbnailUrl: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
        durationSeconds: 180,
        uploader: "Official Artist",
        publishedAt: "2026-01-01T00:00:00Z",
        availability: "available",
        embeddable: true,
        suggestions: { title: "", teluguTitle: "", film: "", singers: "", composer: "", lyricist: "", releaseYear: "" },
      },
      channelId: ENGLISH_CHANNEL_ID,
      sequence: 1,
      title: "Verified English Song",
      film: "Verified Album",
      releaseYear: 2026,
      singers: "Verified Artist",
      composer: "Verified Composer",
      languageCode: "en",
      eraCode: "2020s",
    });

    expect(result).toEqual({ status: "imported", songId: SONG_ID });
    expect(songInsert).toHaveBeenCalledOnce();
    expect(assignmentInsert).toHaveBeenCalledWith({
      song_id: SONG_ID,
      channel_id: ENGLISH_CHANNEL_ID,
      sequence: 1,
      active: true,
    });
  });
});
