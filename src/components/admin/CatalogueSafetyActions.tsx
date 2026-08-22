"use client";

import { MoveRight, Trash2, Unlink } from "lucide-react";
import { useFormStatus } from "react-dom";
import { deleteSongAction, moveSongAssignmentAction, removeAssignmentAction } from "@/app/admin/actions";

type ChannelOption = { id: string; name: string };

function PendingButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-white/20 px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 ${className}`}>
      {pending ? "Working" : children}
    </button>
  );
}

export function AssignmentSafetyActions({ assignmentId, currentChannelId, channels, sequence }: { assignmentId: string; currentChannelId: string; channels: ChannelOption[]; sequence: number }) {
  const targets = channels.filter((channel) => channel.id !== currentChannelId);
  return (
    <div className="space-y-2">
      <form action={removeAssignmentAction} onSubmit={(event) => {
        if (!window.confirm("Remove this song only from the selected channel? The catalogue song and its other channel assignments will remain.")) event.preventDefault();
      }}>
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="confirmation" value="REMOVE" />
        <PendingButton><Unlink className="h-3.5 w-3.5" aria-hidden="true" />Remove from this channel</PendingButton>
      </form>
      {targets.length ? (
        <details className="text-xs text-white/70">
          <summary className="cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-white">Move to another channel</summary>
          <form action={moveSongAssignmentAction} onSubmit={(event) => {
            if (!window.confirm("Move this assignment? The song will be added to the target channel and removed from the current channel.")) event.preventDefault();
          }} className="mt-2 grid gap-2 sm:grid-cols-[1fr_6rem_auto]">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="confirmation" value="MOVE" />
            <select name="targetChannelId" required aria-label="Target channel" className="min-h-9 rounded-md border border-white/15 bg-neutral-900 px-2 focus:outline-none focus:ring-2 focus:ring-white">
              {targets.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
            </select>
            <input name="sequence" type="number" min="1" defaultValue={sequence} required aria-label="Target sequence" className="min-h-9 w-full rounded-md border border-white/15 bg-neutral-900 px-2 focus:outline-none focus:ring-2 focus:ring-white" />
            <PendingButton><MoveRight className="h-3.5 w-3.5" aria-hidden="true" />Move</PendingButton>
          </form>
        </details>
      ) : null}
    </div>
  );
}

export function SongDeleteControl({ songId, title, channelNames }: { songId: string; title: string; channelNames: string[] }) {
  return (
    <details className="mt-2 text-xs text-white/70">
      <summary className="cursor-pointer font-bold text-red-200 focus:outline-none focus:ring-2 focus:ring-white">Delete song</summary>
      <form action={deleteSongAction} className="mt-2 space-y-2 rounded-md border border-red-200/20 bg-red-300/5 p-3">
        <input type="hidden" name="songId" value={songId} />
        <p>This soft-deletes <strong>{title}</strong> and deactivates {channelNames.length} active channel relationship(s). Listening events and feedback remain.</p>
        {channelNames.length ? <p>Affected channels: {channelNames.join(", ")}</p> : null}
        <label className="block font-bold">Type DELETE to confirm
          <input name="confirmation" required pattern="DELETE" autoComplete="off" className="mt-1 min-h-9 w-full rounded-md border border-red-200/25 bg-neutral-950 px-2 focus:outline-none focus:ring-2 focus:ring-red-200" />
        </label>
        <PendingButton className="border-red-200/30 text-red-100"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Soft-delete song</PendingButton>
      </form>
    </details>
  );
}
