import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260815143000_sprint2_catalogue.sql"), "utf8");
const reorderMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260815143200_sequence_reorder_function.sql"), "utf8");
const sprint4Migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260815143300_sprint4_analytics_sponsorship.sql"), "utf8");
const youtubeImportMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260817090000_youtube_import_queue.sql"), "utf8");
const feedbackMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260818120000_sprint6_feedback.sql"), "utf8");
const presenceMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260818143000_sprint6_1_active_listeners.sql"), "utf8");
const englishCleanupMigration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260819120000_add_english_hits_cleanup_placeholders.sql"), "utf8");
const repository = readFileSync(path.join(process.cwd(), "src/lib/catalogue/repository.ts"), "utf8");
const remoteCatalogue = readFileSync(path.join(process.cwd(), "src/lib/catalogue/remote.ts"), "utf8");
const feedbackActions = readFileSync(path.join(process.cwd(), "src/app/admin/(protected)/analytics/actions.ts"), "utf8");

describe("RLS migration", () => {
  it("enables RLS on every Sprint 2 table", () => {
    for (const table of ["channels", "songs", "channel_songs", "admin_profiles", "takedown_requests"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("limits public catalogue reads to active and available records", () => {
    expect(migration).toContain("Public read active channels");
    expect(migration).toContain("active = true and embed_status = 'available'");
    expect(migration).toContain("Public read active channel song assignments");
  });

  it("keeps permanent deletes admin-only", () => {
    expect(migration).toContain('create policy "Only admins delete songs"');
    expect(migration).toContain('on public.songs for delete');
    expect(migration).toContain("using (public.is_active_admin())");
  });

  it("does not create a public takedown select policy", () => {
    expect(migration).not.toContain("Public read takedowns");
    expect(migration).toContain("Public create takedowns");
  });

  it("orders Supabase assignments deterministically", () => {
    expect(repository).toContain('.order("sequence", { referencedTable: "channel_songs", ascending: true })');
    expect(repository).toContain('.order("created_at", { referencedTable: "channel_songs", ascending: true })');
    expect(remoteCatalogue).toContain('a.created_at.localeCompare(b.created_at)');
    expect(remoteCatalogue).toContain('(a.songs?.id ?? "").localeCompare(b.songs?.id ?? "")');
  });

  it("provides a complete reorder function for channel assignments", () => {
    expect(reorderMigration).toContain("reorder_channel_assignments");
    expect(reorderMigration).toContain("position * 10");
    expect(reorderMigration).toContain("invalid assignment order");
  });

  it("keeps raw analytics and sponsor contacts out of public read policies", () => {
    expect(sprint4Migration).toContain("alter table public.listening_events enable row level security");
    expect(sprint4Migration).not.toContain("Public read listening_events");
    expect(sprint4Migration).not.toContain("Public read active sponsors");
    expect(sprint4Migration).toContain("Public create song requests");
  });

  it("creates raw event retention support", () => {
    expect(sprint4Migration).toContain("delete_old_listening_events");
    expect(sprint4Migration).toContain("retention_days integer default 90");
  });

  it("keeps YouTube import queue admin-only", () => {
    expect(youtubeImportMigration).toContain("create table if not exists public.youtube_import_queue");
    expect(youtubeImportMigration).toContain("alter table public.youtube_import_queue enable row level security");
    expect(youtubeImportMigration).toContain("Admins manage youtube import queue");
    expect(youtubeImportMigration).not.toContain("Public read youtube_import_queue");
  });

  it("keeps feedback writes controlled and feedback reads admin-only", () => {
    expect(feedbackMigration).toContain("alter table public.feedback_submissions enable row level security");
    expect(feedbackMigration).toContain('create policy "Active administrators read feedback"');
    expect(feedbackMigration).toContain("using (public.is_active_admin())");
    expect(feedbackMigration).not.toContain("Public read feedback");
    expect(feedbackMigration).not.toContain("Public insert feedback");
    expect(feedbackMigration).toContain("submission_token_hash text not null unique");
  });

  it("requires an active administrator for manual sentiment overrides", () => {
    expect(feedbackActions).toContain('context.profile.role !== "admin"');
    expect(feedbackActions).toContain("admin_sentiment_override: override");
    expect(feedbackActions).toContain('sentiment_status: override ? "manually_reviewed"');
  });

  it("keeps listener rows private and deduplicates browser sessions", () => {
    expect(presenceMigration).toContain("session_hash text primary key");
    expect(presenceMigration).toContain("alter table public.active_listener_sessions enable row level security");
    expect(presenceMigration).not.toContain("Public read active_listener_sessions");
    expect(presenceMigration).not.toContain("Public insert active_listener_sessions");
    expect(presenceMigration).toContain("on conflict (session_hash) do update");
    expect(presenceMigration).toContain("revoke all on function public.upsert_listener_presence");
  });

  it("adds English Hits and cleans only explicitly allowlisted placeholders", () => {
    expect(englishCleanupMigration).toContain("6f3fc628-a517-4dc5-a479-334d6bce7558");
    expect(englishCleanupMigration).toContain("'english-hits'");
    expect(englishCleanupMigration).toContain("scheduled = false");
    expect(englishCleanupMigration).toContain("dummy_song_cleanup_candidates");
    expect(englishCleanupMigration).toContain("and title ilike '%Placeholder%'");
    expect(englishCleanupMigration).toContain("and embed_status = 'unchecked'");
    expect(englishCleanupMigration).not.toContain("delete from public.songs;");
  });
});
