"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importYouTubePlaylistAction, previewYouTubeVideoImportAction, saveYouTubeVideoImportAction } from "@/app/admin/actions";
import type { DbChannel } from "@/types/database";

type Result = Awaited<ReturnType<typeof previewYouTubeVideoImportAction>>;

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function SubmitButton({ label, pendingLabel, disabled = false }: { label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="rounded-md bg-white px-3 py-2 text-sm font-bold text-black transition hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? pendingLabel : label}
    </button>
  );
}

function ActionMessage({ state }: { state: Result | null }) {
  if (!state) return null;
  return (
    <div className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-400/15 text-emerald-50" : "bg-red-400/15 text-red-50"}`}>
      {state.message}
      {state.field ? <p className="mt-1 text-xs opacity-80">Field: {state.field}</p> : null}
      {state.code ? <p className="mt-1 text-xs opacity-80">Code: {state.code}</p> : null}
      {state.results?.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {state.results.map((result) => (
            <li key={`${result.youtubeVideoId}-${result.status}`}>
              {result.youtubeVideoId}: {result.status} - {result.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function YouTubeImportForms({ channels, youtubeApiConfigured }: { channels: DbChannel[]; youtubeApiConfigured: boolean }) {
  const [videoState, videoAction] = useActionState(previewYouTubeVideoImportAction, null);
  const [saveState, saveAction] = useActionState(saveYouTubeVideoImportAction, null);
  const [playlistState, playlistAction] = useActionState(importYouTubePlaylistAction, null);
  const preview = videoState?.preview;
  const suggested = preview?.suggestions;

  return (
    <div className="space-y-6">
      <div className={`rounded-md border px-3 py-2 text-sm ${youtubeApiConfigured ? "border-emerald-200/25 bg-emerald-300/10 text-emerald-50" : "border-amber-200/25 bg-amber-300/10 text-amber-50"}`}>
        <p className="font-bold">Configuration status: {youtubeApiConfigured ? "YouTube metadata import enabled" : "YouTube metadata import disabled"}</p>
        {!youtubeApiConfigured ? (
          <p className="mt-1">Add server-only `YOUTUBE_API_KEY` in `.env.local`, restart the app, then use Fetch metadata or Fetch playlist. Manual song entry remains available.</p>
        ) : null}
      </div>
      <form id="youtube-video-import" action={videoAction} className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
        <h3 className="font-bold">Import YouTube video</h3>
        <label className="block text-sm text-white/75">
          YouTube URL or video ID
          <Input name="youtubeInput" defaultValue={videoState?.values?.youtubeInput ?? ""} required />
        </label>
        <label className="block text-sm text-white/75">
          Website mood channel
          <Select name="channelId" defaultValue={videoState?.values?.channelId ?? channels[0]?.id ?? ""} required>
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
          </Select>
        </label>
        <SubmitButton label="Fetch details" pendingLabel="Fetching" disabled={!youtubeApiConfigured} />
        <ActionMessage state={videoState} />
      </form>

      {preview ? (
        <form action={saveAction} className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
          <h3 className="font-bold">Review video import</h3>
          <input type="hidden" name="youtubeVideoId" value={preview.youtubeVideoId} />
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="aspect-video overflow-hidden rounded-md bg-white/10">
              {preview.thumbnailUrl ? <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="text-sm text-white/75">
              <p className="font-bold text-white">{preview.title}</p>
              <p>{preview.uploader}</p>
              <p>{preview.durationSeconds ? `${preview.durationSeconds}s` : "Duration unavailable"} · {preview.publishedAt?.slice(0, 10) ?? "No publish date"}</p>
              <p>Availability: {preview.availability} · Embeddable: {preview.embeddable ? "yes" : "no"}</p>
              {preview.duplicateSongId ? <p className="mt-1 text-amber-100">Duplicate found. Saving is disabled.</p> : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-white/75">Song title<Input name="title" defaultValue={suggested?.title || preview.title} required /></label>
            <label className="text-sm text-white/75">Telugu title<Input name="teluguTitle" defaultValue={suggested?.teluguTitle ?? ""} /></label>
            <label className="text-sm text-white/75">Film<Input name="film" defaultValue={suggested?.film ?? ""} required /></label>
            <label className="text-sm text-white/75">Release year<Input name="releaseYear" type="number" min="1900" max="2100" defaultValue={suggested?.releaseYear || preview.publishedAt?.slice(0, 4) || ""} required /></label>
            <label className="text-sm text-white/75">Singers<Input name="singers" defaultValue={suggested?.singers ?? ""} required /></label>
            <label className="text-sm text-white/75">Composer<Input name="composer" defaultValue={suggested?.composer ?? ""} required /></label>
            <label className="text-sm text-white/75">Lyricist<Input name="lyricist" defaultValue={suggested?.lyricist ?? ""} /></label>
            <label className="text-sm text-white/75">Channel<Select name="channelId" defaultValue={preview.suggestedChannelId} required>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select></label>
            <label className="text-sm text-white/75">Sequence<Input name="sequence" type="number" min="1" defaultValue={preview.suggestedSequence} required /></label>
          </div>
          <Textarea readOnly value={preview.description} rows={3} aria-label="YouTube description" />
          <SubmitButton label="Confirm import" pendingLabel="Importing" />
          <ActionMessage state={saveState} />
        </form>
      ) : null}

      <form id="youtube-playlist-import" action={playlistAction} className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
        <h3 className="font-bold">Import YouTube playlist</h3>
        <label className="block text-sm text-white/75">Playlist URL or ID<Input name="playlistInput" defaultValue={playlistState?.values?.playlistInput ?? ""} required /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-white/75">Bulk channel<Select name="channelId" defaultValue={playlistState?.values?.channelId ?? channels[0]?.id ?? ""}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select></label>
          <label className="text-sm text-white/75">Starting sequence<Input name="startingSequence" type="number" min="1" defaultValue={playlistState?.values?.startingSequence ?? "1"} /></label>
        </div>
        <SubmitButton label="Fetch playlist" pendingLabel="Fetching playlist" disabled={!youtubeApiConfigured} />
        <ActionMessage state={playlistState} />
      </form>
    </div>
  );
}
