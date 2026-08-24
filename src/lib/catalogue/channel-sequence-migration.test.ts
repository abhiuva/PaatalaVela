import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260824130000_channel_sequence_integrity.sql", "utf8");

describe("channel sequence integrity migration", () => {
  it("backs up every assignment with original and repaired positions before repair", () => {
    expect(migration).toContain("channel_sequence_repair_backup");
    expect(migration).toContain("original_sequence");
    expect(migration).toContain("repaired_sequence");
    expect(migration).toContain("source_count <> backup_count");
  });

  it("enforces positive per-channel sequence uniqueness", () => {
    expect(migration).toContain("check (sequence > 0)");
    expect(migration).toContain("unique (channel_id, sequence)");
  });

  it("serializes channel writes and uses two-stage reindexing", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("sequence = 1000000 + requested.position");
    expect(migration).toContain("sequence = requested.position");
  });

  it("serializes the same YouTube video across different channel imports", () => {
    expect(migration).toContain("'youtube:' || (p_song->>'youtube_video_id')");
    expect(migration.indexOf("'youtube:' || (p_song->>'youtube_video_id')")).toBeLessThan(migration.indexOf("select id into existing_song_id"));
  });

  it("exposes one atomic import transaction and keeps it server-only", () => {
    expect(migration).toContain("function public.import_song_with_assignment_atomic");
    expect(migration).toContain("grant execute on function public.import_song_with_assignment_atomic");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("revoke all on function public.import_song_with_assignment_atomic");
  });

  it("normalizes channel order after unlink, move, and soft delete", () => {
    expect(migration.match(/normalize_channel_sequences/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
