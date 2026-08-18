"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { bulkImportQueuedYouTubeItemsAction, bulkRejectQueuedYouTubeItemsAction, importQueuedYouTubeItemAction, rejectQueuedYouTubeItemAction } from "@/app/admin/actions";
import type { DbChannel, DbYouTubeImportQueue } from "@/types/database";

type Result = Awaited<ReturnType<typeof bulkImportQueuedYouTubeItemsAction>>;

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white" />;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-white px-3 py-2 text-sm font-bold text-black transition hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? "Working" : label}
    </button>
  );
}

function ActionMessage({ state }: { state: Result | null }) {
  if (!state) return null;
  return (
    <div className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-400/15 text-emerald-50" : "bg-red-400/15 text-red-50"}`}>
      {state.message}
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

export function YouTubeImportQueueReview({ channels, queue }: { channels: DbChannel[]; queue: DbYouTubeImportQueue[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importState, importAction] = useActionState(bulkImportQueuedYouTubeItemsAction, null);
  const [rejectState, rejectAction] = useActionState(bulkRejectQueuedYouTubeItemsAction, null);
  const visibleIds = useMemo(() => queue.map((item) => item.id), [queue]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section id="youtube-imports" className="rounded-lg border border-white/10 bg-white/8 p-4">
      <h2 className="text-2xl font-black">YouTube Imports</h2>
      <p className="mt-1 text-sm text-white/65">Playlist items stay unpublished until an administrator imports them. Duplicate and unavailable items are marked for review.</p>

      <form action={importAction} className="mt-4 space-y-3">
        {Array.from(selected).map((id) => <input key={id} type="hidden" name="queueIds" value={id} />)}
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto_auto]">
          <label className="text-sm text-white/75">Bulk channel<Select name="bulkChannelId">{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select></label>
          <label className="text-sm text-white/75">Starting sequence<Input name="bulkStartingSequence" type="number" min="1" defaultValue="1" /></label>
          <button type="button" onClick={toggleAllVisible} className="self-end rounded-md border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">
            {allVisibleSelected ? "Clear visible" : "Select all visible"}
          </button>
          <SubmitButton label="Bulk import" />
        </div>
        <ActionMessage state={importState} />
      </form>

      <form action={rejectAction} className="mt-3 space-y-3">
        {Array.from(selected).map((id) => <input key={id} type="hidden" name="queueIds" value={id} />)}
        <button className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">Bulk reject selected</button>
        <ActionMessage state={rejectState} />
      </form>

      <div className="mt-4 max-h-[34rem] overflow-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead className="bg-black/35 text-xs uppercase tracking-[0.12em] text-white/55">
            <tr>
              <th className="p-3"><span className="sr-only">Select</span></th>
              <th className="p-3">Video</th>
              <th className="p-3">Availability</th>
              <th className="p-3">Suggested metadata</th>
              <th className="p-3">Channel</th>
              <th className="p-3">Sequence</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? <tr><td className="p-3 text-white/60" colSpan={7}>No playlist items queued yet.</td></tr> : null}
            {queue.map((item) => {
              const suggested = item.suggested_metadata as Record<string, unknown>;
              return (
                <tr key={item.id} className="border-t border-white/10 align-top">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} className="accent-white" aria-label={`Select ${item.source_title}`} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-3">
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-white/10">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}</div>
                      <div>
                        <p className="font-bold">{item.source_title}</p>
                        <p className="text-white/55">{item.duration_seconds ? `${item.duration_seconds}s` : "duration missing"} · {item.uploader ?? "Unknown uploader"} · {item.published_at?.slice(0, 10) ?? "No date"}</p>
                        <p className="text-white/55">{item.youtube_video_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <p>{item.status}</p>
                    <p className="text-white/55">{item.availability} · {item.embeddable ? "embeddable" : "not embeddable"}</p>
                    {item.duplicate_song_id ? <p className="text-amber-100">Duplicate</p> : null}
                  </td>
                  <td className="p-3 text-white/70">
                    <p>Title: {String(suggested.title ?? item.source_title)}</p>
                    <p>Film: {String(suggested.film ?? "Needs review") || "Needs review"}</p>
                    <p>Singers: {String(suggested.singers ?? "Needs review") || "Needs review"}</p>
                    <p>Composer: {String(suggested.composer ?? "Needs review") || "Needs review"}</p>
                  </td>
                  <td className="p-3">
                    <form id={`import-${item.id}`} action={importQueuedYouTubeItemAction} className="space-y-2">
                      <input type="hidden" name="queueId" value={item.id} />
                      <Select name="channelId" defaultValue={item.channel_id ?? channels[0]?.id}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select>
                    </form>
                  </td>
                  <td className="p-3"><Input form={`import-${item.id}`} name="sequence" type="number" min="1" defaultValue={item.sequence ?? 1} /></td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button form={`import-${item.id}`} className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Import</button>
                      <form action={rejectQueuedYouTubeItemAction}>
                        <input type="hidden" name="queueId" value={item.id} />
                        <button className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold">Reject</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
