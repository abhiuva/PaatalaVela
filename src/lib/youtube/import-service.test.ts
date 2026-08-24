import { describe, expect, it, vi } from "vitest";
import { createSongWithAssignment } from "@/lib/youtube/import-service";

const CHANNEL_ID = "6f3fc628-a517-4dc5-a479-334d6bce7558";
const SONG_ID = "b7657310-9979-419a-b5b8-a46c62e5da91";
const ASSIGNMENT_ID = "c44a474f-ff6f-468f-b593-8180d2690069";

function input(sequence = 1) {
  return {
    metadata: {
      youtubeVideoId: "M7lc1UVf-VE",
      youtubeUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      title: "Verified English Song",
      description: "Official metadata",
      thumbnailUrl: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
      durationSeconds: 180,
      uploader: "Official Artist",
      publishedAt: "2026-01-01T00:00:00Z",
      availability: "available" as const,
      embeddable: true,
      suggestions: { title: "", teluguTitle: "", film: "", singers: "", composer: "", lyricist: "", releaseYear: "" },
    },
    channelId: CHANNEL_ID,
    sequence,
    title: "Verified English Song",
    film: "Verified Album",
    releaseYear: 2026,
    singers: "Verified Artist",
    composer: "Verified Composer",
    languageCode: "en",
    eraCode: "2020s",
    actorId: "75cd8f4c-df4e-432b-9b23-26865ec13330",
  };
}

function service(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(result) };
}

describe("atomic YouTube import", () => {
  it("creates a song and assignment through one server RPC", async () => {
    const client = service({ data: { status: "imported", song_id: SONG_ID, assignment_id: ASSIGNMENT_ID, sequence: 1 }, error: null });
    await expect(createSongWithAssignment(client as never, input())).resolves.toEqual({ status: "imported", songId: SONG_ID, assignmentId: ASSIGNMENT_ID, sequence: 1 });
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith("import_song_with_assignment_atomic", expect.objectContaining({ p_channel_id: CHANNEL_ID, p_requested_sequence: 1 }));
  });

  it.each(["assigned_existing", "already_assigned", "reactivated"] as const)("returns the idempotent %s result", async (status) => {
    const client = service({ data: { status, song_id: SONG_ID, assignment_id: ASSIGNMENT_ID, sequence: 2 }, error: null });
    await expect(createSongWithAssignment(client as never, input(2))).resolves.toMatchObject({ status, songId: SONG_ID, assignmentId: ASSIGNMENT_ID, sequence: 2 });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("reports permission failure without issuing a fallback write", async () => {
    const client = service({ data: null, error: { code: "42501", message: "secret database details" } });
    await expect(createSongWithAssignment(client as never, input())).rejects.toMatchObject({ stage: "permission", safeCode: "ADMIN_IMPORT_PERMISSION_DENIED" });
    expect(client.rpc).toHaveBeenCalledOnce();
  });

  it("reports sequence conflict with a stable stage and code", async () => {
    const client = service({ data: null, error: { code: "23505", message: "channel_songs_channel_sequence_key" } });
    await expect(createSongWithAssignment(client as never, input())).rejects.toMatchObject({ stage: "sequence_conflict", safeCode: "ADMIN_IMPORT_SEQUENCE_CONFLICT" });
  });

  it("rejects malformed transaction responses", async () => {
    const client = service({ data: { status: "imported", song_id: SONG_ID }, error: null });
    await expect(createSongWithAssignment(client as never, input())).rejects.toMatchObject({ stage: "transaction", safeCode: "ADMIN_IMPORT_RESPONSE_INVALID" });
  });

  it("rejects an invalid channel UUID before calling Supabase", async () => {
    const client = service({ data: null, error: null });
    await expect(createSongWithAssignment(client as never, { ...input(), channelId: "english-hits" })).rejects.toMatchObject({ stage: "validation", safeCode: "ADMIN_IMPORT_CHANNEL_UUID_INVALID" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects missing required catalogue metadata before calling Supabase", async () => {
    const client = service({ data: null, error: null });
    await expect(createSongWithAssignment(client as never, { ...input(), singers: "" })).rejects.toMatchObject({ stage: "validation", safeCode: "ADMIN_IMPORT_SINGERS_REQUIRED" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("labels taxonomy foreign-key failures accurately", async () => {
    const client = service({ data: null, error: { code: "23503", message: "song_moods_mood_code_fkey" } });
    await expect(createSongWithAssignment(client as never, input())).rejects.toMatchObject({ stage: "validation", safeCode: "ADMIN_IMPORT_TAXONOMY_INVALID" });
  });
});
