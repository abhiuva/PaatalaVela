import { updateSongRequestAction } from "@/app/admin/(protected)/song-requests/actions";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { SongRequestStatus } from "@/types/database";

const statuses: SongRequestStatus[] = ["new", "reviewing", "accepted", "rejected", "duplicate"];

export default async function AdminSongRequestsPage() {
  const supabase = createServiceSupabaseClient();
  const { data } = supabase ? await supabase.from("song_requests").select("*, channels(name)").order("created_at", { ascending: false }) : { data: [] };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-3xl font-black">Song Requests</h1>
      <section className="space-y-3">
        {(data ?? []).map((request) => (
          <form key={request.id} action={updateSongRequestAction} className="rounded-lg border border-white/10 bg-white/8 p-4">
            <input type="hidden" name="requestId" value={request.id} />
            <p className="text-lg font-black">{request.song_name}</p>
            <p className="text-sm text-white/65">{request.film_name} · {request.singer ?? "Singer not provided"}</p>
            <p className="mt-2 text-sm text-white/75">{request.reason ?? "No reason provided."}</p>
            {request.youtube_url ? <a href={request.youtube_url} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">Suggested YouTube URL</a> : null}
            <div className="mt-3 flex gap-2">
              <select name="status" defaultValue={request.status} className="rounded-md bg-black/25 px-3 py-2">
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <button className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold">Update</button>
            </div>
          </form>
        ))}
        {(data ?? []).length === 0 ? <p className="text-white/60">No song requests yet.</p> : null}
      </section>
    </main>
  );
}
