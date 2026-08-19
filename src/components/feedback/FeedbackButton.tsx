"use client";

import { MessageSquareText, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { feedbackCategories } from "@/lib/feedback/validation";
import { getAnalyticsConsent, getOrCreateSessionId, type AnalyticsConsent } from "@/lib/analytics/client";
import { uuidOrNull } from "@/lib/validation/uuid";

const categoryLabels: Record<(typeof feedbackCategories)[number], string> = {
  music_selection: "Music selection",
  playback: "Playback",
  channel_experience: "Channel experience",
  design: "Design",
  performance: "Performance",
  other: "Other",
};

type Props = { channelId?: string | null; songId?: string | null; appVersion?: string };
type SubmitState = "idle" | "submitting" | "success" | "error";

function newToken() {
  return crypto.randomUUID();
}

export function FeedbackButton({ channelId, songId, appVersion }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [analyticsConsent, setAnalyticsConsentState] = useState<AnalyticsConsent>("unknown");
  const [message, setMessage] = useState("");
  const tokenRef = useRef("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const syncConsent = () => setAnalyticsConsentState(getAnalyticsConsent());
    const timeout = window.setTimeout(syncConsent, 0);
    window.addEventListener("analytics-consent-changed", syncConsent);
    return () => { window.clearTimeout(timeout); window.removeEventListener("analytics-consent-changed", syncConsent); };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!rating) {
      setState("error");
      setMessage("Overall rating: choose a rating from 1 to 5. (FEEDBACK_RATING_REQUIRED)");
      return;
    }
    setState("submitting");
    setMessage("");
    try {
      const sessionId = window.sessionStorage.getItem("telugu-radio-session") ?? getOrCreateSessionId();
      window.sessionStorage.setItem("telugu-radio-session", sessionId);
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
          category,
          channelId: uuidOrNull(channelId),
          songId: uuidOrNull(songId),
          pagePath: window.location.pathname,
          anonymousSessionId: sessionId,
          appVersion: appVersion ?? null,
          submissionToken: tokenRef.current || newToken(),
          website: "",
        }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; code?: string; field?: string };
      if (!response.ok || !body.ok) {
        setState("error");
        setMessage(`${body.field ? `${body.field}: ` : ""}${body.message ?? "Unable to submit feedback."}${body.code ? ` (${body.code})` : ""}`);
        return;
      }
      setState("success");
      setMessage(body.message ?? "Thank you for your feedback.");
    } catch {
      setState("error");
      setMessage("Feedback could not be sent. Your answers are still here; please retry. (FEEDBACK_NETWORK_ERROR)");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!tokenRef.current) tokenRef.current = newToken();
          setOpen(true);
        }}
        className={`fixed right-4 z-[55] flex h-11 w-11 items-center justify-center gap-2 rounded-md border border-white/25 bg-neutral-950/92 p-0 text-sm font-bold text-white shadow-xl backdrop-blur transition hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-white sm:bottom-5 sm:right-5 sm:w-auto sm:px-3 ${analyticsConsent === "unknown" ? "bottom-72" : "bottom-24"}`}
        aria-haspopup="dialog"
        aria-label="Share feedback"
        title="Share feedback"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Share feedback</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-lg border border-white/15 bg-neutral-950 p-5 text-white shadow-2xl sm:max-w-lg sm:rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Pilot feedback</p>
                <h2 id="feedback-title" className="mt-1 text-2xl font-black">How is your listening experience?</h2>
              </div>
              <button ref={closeRef} type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/15 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close feedback">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {state === "success" ? (
              <div className="py-8" aria-live="polite">
                <p className="text-xl font-black text-emerald-200">Thank you</p>
                <p className="mt-2 text-white/75">{message}</p>
                <button type="button" onClick={close} className="mt-6 rounded-md bg-white px-4 py-2 font-bold text-black focus:outline-none focus:ring-2 focus:ring-emerald-300">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-5">
                <p className="text-sm leading-6 text-white/70">Your anonymous feedback helps us improve the pilot experience.</p>
                <fieldset>
                  <legend className="text-sm font-bold">Overall experience <span className="text-red-300">Required</span></legend>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <label key={value} className={`grid min-h-12 cursor-pointer place-items-center rounded-md border font-black focus-within:ring-2 focus-within:ring-white ${rating === value ? "border-emerald-300 bg-emerald-300 text-black" : "border-white/20 bg-white/5"}`}>
                        <input className="sr-only" type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} required />
                        <span aria-hidden="true">{value}</span><span className="sr-only">{value} out of 5</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm font-bold">
                  Category <span className="font-normal text-white/50">Optional</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-white/20 bg-neutral-900 px-3 text-white focus:outline-none focus:ring-2 focus:ring-white">
                    <option value="">Choose a category</option>
                    {feedbackCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold">
                  Comment <span className="font-normal text-white/50">Optional</span>
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={5} className="mt-2 w-full resize-y rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white" />
                  <span className="mt-1 block text-right text-xs font-normal tabular-nums text-white/50">{comment.length}/1000</span>
                </label>
                <label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                {state === "error" ? <p role="alert" className="rounded-md border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{message}</p> : null}
                <button type="submit" disabled={state === "submitting"} className="min-h-11 w-full rounded-md bg-emerald-300 px-4 py-2 font-black text-neutral-950 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60">
                  {state === "submitting" ? "Sending feedback…" : "Send feedback"}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
