"use client";

import { FormEvent, useEffect, useState } from "react";
import { getOrCreateSessionId, trackEvent } from "@/lib/analytics/client";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; reference: string }
  | { status: "error"; message: string };

export function TakedownForm() {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  useEffect(() => {
    trackEvent("takedown_form_opened", { session_id: getOrCreateSessionId() });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/takedown", {
      method: "POST",
      body: formData,
    });
    const body = (await response.json()) as { ok: boolean; message?: string; reference?: string };

    if (!response.ok || !body.ok || !body.reference) {
      setState({ status: "error", message: body.message ?? "Unable to submit the request." });
      return;
    }

    event.currentTarget.reset();
    setState({ status: "success", reference: body.reference });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold text-white/80">
        Song or YouTube URL
        <input name="songOrYoutubeUrl" required className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-white/80">
          Claimant name
          <input name="claimantName" required className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
        </label>
        <label className="block text-sm font-semibold text-white/80">
          Claimant email
          <input name="claimantEmail" type="email" required className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-white/80">
        Rights holder represented
        <input name="rightsHolder" required className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
      </label>
      <label className="block text-sm font-semibold text-white/80">
        Request details
        <textarea name="requestDetails" required minLength={20} rows={5} className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
      </label>
      <label className="block text-sm font-semibold text-white/80">
        Evidence link
        <input name="evidenceUrl" type="url" className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
      </label>
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-sm text-white/80">
        <input name="confirmation" type="checkbox" required className="mt-1 accent-white" />
        I confirm that the submitted information is accurate to the best of my knowledge.
      </label>
      <button type="submit" disabled={state.status === "submitting"} className="min-h-11 rounded-md bg-white px-4 font-bold text-black hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60">
        {state.status === "submitting" ? "Submitting" : "Submit request"}
      </button>
      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-200/25 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-50">
          Request received. Reference: {state.reference}. This is not a legal promise about timing or outcome.
        </p>
      ) : null}
      {state.status === "error" ? <p className="rounded-md border border-red-200/25 bg-red-300/10 px-3 py-2 text-sm text-red-50">{state.message}</p> : null}
    </form>
  );
}
