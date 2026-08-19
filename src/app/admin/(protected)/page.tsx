import {
  assignSongAction,
  checkYouTubeAvailabilityAction,
  moveAssignmentAction,
  removeAssignmentAction,
  reorderAssignmentAction,
  saveSongAction,
  setSongStatusAction,
  toggleSongActiveAction,
  updateChannelAction,
  updateTakedownAction,
} from "@/app/admin/actions";
import { ActionStateForm } from "@/components/admin/ActionStateForm";
import { YouTubeImportForms } from "@/components/admin/YouTubeImportForms";
import { YouTubeImportQueueReview } from "@/components/admin/YouTubeImportQueueReview";
import { getAdminDashboardData } from "@/lib/admin/data";
import { formatScheduleRange } from "@/lib/schedule";
import type { EmbedStatus, TakedownStatus } from "@/types/database";

const embedStatuses: EmbedStatus[] = ["unchecked", "available", "unavailable", "embedding_disabled", "region_restricted"];
const takedownStatuses: TakedownStatus[] = ["new", "reviewing", "accepted", "rejected"];

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

export default async function AdminPage() {
  const data = await getAdminDashboardData();
  const activeSongs = data.songs.filter((song) => song.active);
  const unavailableSongs = data.songs.filter((song) => ["unavailable", "embedding_disabled", "region_restricted"].includes(song.embed_status));
  const uncheckedSongs = data.songs.filter((song) => song.embed_status === "unchecked");
  const newTakedowns = data.takedowns.filter((request) => request.status === "new");
  const missingDurationSongs = data.songs.filter((song) => song.active && (!song.duration_seconds || song.duration_seconds <= 0));
  const songsPerChannel = data.channels.map((channel) => ({
    channel,
    count: data.assignments.filter((assignment) => assignment.channel_id === channel.id && assignment.active && assignment.songs?.active).length,
  }));
  const duplicateSequenceWarnings = data.channels.flatMap((channel) => {
    const counts = new Map<number, number>();
    data.assignments
      .filter((assignment) => assignment.channel_id === channel.id && assignment.active)
      .forEach((assignment) => counts.set(assignment.sequence, (counts.get(assignment.sequence) ?? 0) + 1));
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([sequence, count]) => `${channel.name}: sequence ${sequence} is used ${count} times.`);
  });

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Overview">
        {[
          ["Active songs", activeSongs.length],
          ["Unavailable", unavailableSongs.length],
          ["Unchecked", uncheckedSongs.length],
          ["Missing duration", missingDurationSongs.length],
          ["Channels", data.channels.length],
          ["New takedowns", newTakedowns.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/8 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-white/10 bg-white/8 p-4">
        <h2 className="text-2xl font-black">Songs</h2>
        <p className="mt-1 text-sm text-white/65">Search and filters are browser-native on this compact MVP page. Use the table text search in your browser for quick catalogue lookup.</p>
        {!data.youtubeCheckerConfigured ? (
          <p className="mt-3 rounded-md border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
            YouTube metadata fetching is disabled until `YOUTUBE_API_KEY` is configured. Manual song entry and the import review UI remain available.
          </p>
        ) : null}
        {missingDurationSongs.length > 0 ? (
          <p className="mt-3 rounded-md border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
            {missingDurationSongs.length} active song(s) are missing duration and are excluded from scheduled live positioning.
          </p>
        ) : null}
        {duplicateSequenceWarnings.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
            {duplicateSequenceWarnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}

        <div className="mt-5 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div id="manual-song-entry" className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Add manually</p>
              <ActionStateForm action={saveSongAction} submitLabel="Add song">
                <h3 className="font-bold">Add song</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-white/75">Title<Input name="title" required /></label>
                  <label className="text-sm text-white/75">Telugu title<Input name="teluguTitle" /></label>
                  <label className="text-sm text-white/75">Film<Input name="film" required /></label>
                  <label className="text-sm text-white/75">Release year<Input name="releaseYear" type="number" min="1900" max="2100" required /></label>
                  <label className="text-sm text-white/75">Duration seconds<Input name="durationSeconds" type="number" min="1" required /></label>
                  <label className="text-sm text-white/75">Singers, comma-separated<Input name="singers" required /></label>
                  <label className="text-sm text-white/75">Composer<Input name="composer" required /></label>
                  <label className="text-sm text-white/75">Lyricist<Input name="lyricist" /></label>
                  <label className="text-sm text-white/75">YouTube URL or ID<Input name="youtubeInput" required /></label>
                  <label className="text-sm text-white/75">Spotify URL<Input name="spotifyUrl" type="url" /></label>
                  <label className="text-sm text-white/75">YouTube Music URL<Input name="youtubeMusicUrl" type="url" /></label>
                  <label className="text-sm text-white/75">Thumbnail URL<Input name="thumbnailUrl" type="url" /></label>
                  <label className="text-sm text-white/75">Availability<Select name="embedStatus" defaultValue="unchecked">{embedStatuses.map((status) => <option key={status}>{status}</option>)}</Select></label>
                </div>
                <label className="block text-sm text-white/75">Editorial note<Textarea name="editorialNote" rows={2} /></label>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-bold text-white/75">Assign to channels</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.channels.map((channel) => (
                      <label key={channel.id} className="flex items-center gap-2 text-sm text-white/75">
                        <input type="checkbox" name="channelIds" value={channel.id} className="accent-white" /> {channel.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </ActionStateForm>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-white/70" aria-label="Song entry options">
              <a className="rounded-md border border-white/15 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-white" href="#manual-song-entry">Add manually</a>
              <a className="rounded-md border border-white/15 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-white" href="#youtube-video-import">Import YouTube video</a>
              <a className="rounded-md border border-white/15 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-white" href="#youtube-playlist-import">Import YouTube playlist</a>
            </div>
            <YouTubeImportForms channels={data.channels} youtubeApiConfigured={data.youtubeCheckerConfigured} />
          </div>

          <div className="max-h-[42rem] overflow-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-black/35 text-xs uppercase tracking-[0.12em] text-white/55">
                <tr>
                  <th className="p-3">Song</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assign</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.songs.map((song) => (
                  <tr key={song.id} className="border-t border-white/10 align-top">
                    <td className="p-3">
                      <p className="font-bold">{song.title}</p>
                      <p className="text-white/55">{song.film} · {song.release_year} · {song.duration_seconds ? `${song.duration_seconds}s` : "missing duration"} · {song.youtube_video_id}</p>
                      <a className="text-white underline underline-offset-4" href={song.youtube_url} target="_blank" rel="noreferrer">Open YouTube source</a>
                    </td>
                    <td className="p-3">
                      <form action={setSongStatusAction} className="space-y-2">
                        <input type="hidden" name="songId" value={song.id} />
                        <Select name="embedStatus" defaultValue={song.embed_status}>{embedStatuses.map((status) => <option key={status}>{status}</option>)}</Select>
                        <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Mark</button>
                      </form>
                    </td>
                    <td className="p-3">
                      <form action={assignSongAction} className="space-y-2">
                        <input type="hidden" name="songId" value={song.id} />
                        <Select name="channelId">{data.channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select>
                        <Input name="sequence" type="number" min="1" placeholder="Sequence" />
                        <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Assign</button>
                      </form>
                    </td>
                    <td className="p-3 space-y-2">
                      <form action={toggleSongActiveAction}>
                        <input type="hidden" name="songId" value={song.id} />
                        <input type="hidden" name="active" value={String(song.active)} />
                        <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">{song.active ? "Archive" : "Activate"}</button>
                      </form>
                      <form action={checkYouTubeAvailabilityAction}>
                        <input type="hidden" name="songId" value={song.id} />
                        <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Check availability</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <YouTubeImportQueueReview channels={data.channels} queue={data.youtubeImportQueue} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/8 p-4">
          <h2 className="text-2xl font-black">Channels</h2>
          <div className="mt-4 space-y-4">
            {data.channels.map((channel) => (
              <ActionStateForm key={channel.id} action={updateChannelAction} submitLabel="Save channel">
                <input type="hidden" name="id" value={channel.id} />
                <p className="font-bold">{channel.name}</p>
                <p className="text-sm text-white/55">{channel.scheduled ? `Locked schedule: ${formatScheduleRange({ startHour: channel.start_hour, endHour: channel.end_hour })}` : "Optional on-demand channel"}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-white/75">English name<Input name="name" defaultValue={channel.name} required /></label>
                  <label className="text-sm text-white/75">Telugu name<Input name="teluguName" defaultValue={channel.telugu_name} required /></label>
                  <label className="text-sm text-white/75 sm:col-span-2">Positioning<Input name="positioning" defaultValue={channel.positioning} required /></label>
                  <label className="text-sm text-white/75">Mood image URL<Input name="backgroundImageUrl" defaultValue={channel.background_image_url ?? ""} type="url" /></label>
                  <label className="text-sm text-white/75">Visual order<Input name="displayOrder" defaultValue={channel.display_order} type="number" min="1" max="99" /></label>
                  <label className="text-sm text-white/75">Primary<Input name="primaryColor" defaultValue={channel.primary_color} /></label>
                  <label className="text-sm text-white/75">Secondary<Input name="secondaryColor" defaultValue={channel.secondary_color} /></label>
                  <label className="text-sm text-white/75">Accent<Input name="accentColor" defaultValue={channel.accent_color} /></label>
                </div>
              </ActionStateForm>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-white/8 p-4">
            <h2 className="text-2xl font-black">Channel Order</h2>
            <div className="mt-4 space-y-3">
              {songsPerChannel.map(({ channel, count }) => (
                <div key={channel.id} className="rounded-md bg-black/25 px-3 py-2 text-sm">
                  <p className="flex justify-between"><span>{channel.name}</span><span>{count} assigned</span></p>
                  <p className="mt-1 text-xs text-white/55">
                    Next five: {data.assignments.filter((assignment) => assignment.channel_id === channel.id && assignment.active).slice(0, 5).map((assignment) => assignment.songs?.title).filter(Boolean).join(" → ") || "No active assignments"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {data.assignments.map((assignment) => (
                <div key={assignment.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-white/10 p-2 text-sm">
                  <form action={reorderAssignmentAction} className="grid grid-cols-[1fr_5rem_auto_auto] items-end gap-2">
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <span className="min-w-0 truncate">
                      #{assignment.sequence} · {assignment.channels?.name} · {assignment.songs?.title}
                      {!assignment.songs?.duration_seconds ? <span className="ml-2 text-amber-200">Missing duration</span> : null}
                    </span>
                    <Input name="sequence" type="number" min="1" defaultValue={assignment.sequence} aria-label="Sequence" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" value="true" defaultChecked={assignment.active} /> Active</label>
                    <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Save</button>
                  </form>
                  <div className="flex gap-1">
                    <form action={moveAssignmentAction}>
                      <input type="hidden" name="channelId" value={assignment.channel_id} />
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold" aria-label="Move song up">Up</button>
                    </form>
                    <form action={moveAssignmentAction}>
                      <input type="hidden" name="channelId" value={assignment.channel_id} />
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold" aria-label="Move song down">Down</button>
                    </form>
                    <form action={removeAssignmentAction}>
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold" aria-label="Remove song from channel">Remove</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/8 p-4">
            <h2 className="text-2xl font-black">Takedown Requests</h2>
            <div className="mt-4 space-y-4">
              {data.takedowns.length === 0 ? <p className="text-sm text-white/60">No takedown requests yet.</p> : null}
              {data.takedowns.map((request) => (
                <form key={request.id} action={updateTakedownAction} className="space-y-3 rounded-md border border-white/10 p-3 text-sm">
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="songId" value={request.song_id ?? ""} />
                  <div>
                    <p className="font-bold">{request.claimant_name} · {request.claimant_email}</p>
                    <p className="text-white/60">{request.rights_holder}</p>
                    <p className="mt-2 text-white/75">{request.request_details}</p>
                    {request.evidence_url ? <a href={request.evidence_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Evidence</a> : null}
                  </div>
                  <Select name="status" defaultValue={request.status}>{takedownStatuses.map((status) => <option key={status}>{status}</option>)}</Select>
                  <Textarea name="internalNotes" defaultValue={request.internal_notes ?? ""} rows={2} placeholder="Internal notes" />
                  <label className="flex items-center gap-2 text-white/75"><input type="checkbox" name="disableSong" /> Disable affected song</label>
                  <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Update request</button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
