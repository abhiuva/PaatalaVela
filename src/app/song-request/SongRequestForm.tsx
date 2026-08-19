"use client";

import { FormEvent, useState } from "react";
import { channels } from "@/data/channels";
import { trackEvent } from "@/lib/analytics/client";
import { isUuid } from "@/lib/validation/uuid";

type State = { status: "idle" | "submitting" } | { status: "success"; reference: string } | { status: "error"; message: string };

export function SongRequestForm() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/song-request", { method: "POST", body: formData });
    const body = (await response.json()) as { ok: boolean; reference?: string; channelId?: string; message?: string };
    if (!response.ok || !body.ok || !body.reference) {
      setState({ status: "error", message: body.message ?? "Unable to submit request." });
      return;
    }
    if (isUuid(body.channelId)) {
      trackEvent("song_request_submitted", {
        session_id: window.sessionStorage.getItem("telugu-radio-session") ?? "session_unset",
        requested_channel_id: body.channelId,
      });
    }
    event.currentTarget.reset();
    setState({ status: "success", reference: body.reference });
  }

  return (
    <form
      onSubmit={submit}
      onFocus={() => trackEvent("song_request_started", { session_id: window.sessionStorage.getItem("telugu-radio-session") ?? "session_unset" })}
      className="space-y-4"
    >
      <input name="songName" required placeholder="Song name" className="w-full rounded-md bg-black/30 px-3 py-2" />
      <input name="filmName" required placeholder="Film name" className="w-full rounded-md bg-black/30 px-3 py-2" />
      <input name="singer" placeholder="Singer (optional)" className="w-full rounded-md bg-black/30 px-3 py-2" />
      <input name="youtubeUrl" type="url" placeholder="YouTube URL (optional)" className="w-full rounded-md bg-black/30 px-3 py-2" />
      <select name="requestedChannelId" required className="w-full rounded-md bg-black/30 px-3 py-2">
        {channels.map((channel) => <option key={channel.slug} value={channel.slug}>{channel.name}</option>)}
      </select>
      <textarea name="reason" placeholder="Why should this fit the channel? (optional)" className="w-full rounded-md bg-black/30 px-3 py-2" />
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button disabled={state.status === "submitting"} className="rounded-md bg-white px-4 py-2 font-bold text-black">Submit request</button>
      {state.status === "success" ? <p className="text-emerald-100">Request received. Reference: {state.reference}. Admin review is required before any catalogue change.</p> : null}
      {state.status === "error" ? <p className="text-red-100">{state.message}</p> : null}
    </form>
  );
}
