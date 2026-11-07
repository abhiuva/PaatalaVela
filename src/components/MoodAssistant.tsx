"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Play, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { getOrCreateSessionId, trackEvent } from "@/lib/analytics/client";
import type { MoodAssistantResponse, MoodConversationTurn } from "@/lib/mood-assistant/types";
import type { Song } from "@/types/radio";

type MoodAssistantProps = {
  active: boolean;
  currentQueueIds: string[];
  playedSongIds: string[];
  onActivate: (songs: Song[], generationId: string) => void;
};

const suggestions = ["Driving", "Rain", "Breakup", "Party", "Devotional", "Melody"];

function durationLabel(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function MoodAssistant({ active, currentQueueIds, playedSongIds, onActivate }: MoodAssistantProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [language, setLanguage] = useState<"" | "te" | "hi" | "en">("");
  const [targetMode, setTargetMode] = useState<"duration" | "count">("duration");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [songCount, setSongCount] = useState(12);
  const [conversation, setConversation] = useState<MoodConversationTurn[]>([]);
  const [result, setResult] = useState<MoodAssistantResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      trackEvent("mood_assistant_opened", { session_id: getOrCreateSessionId() });
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const generate = async (repeat = false) => {
    const listenerMessage = (repeat ? lastMessage : message).trim();
    if (!listenerMessage || status === "loading") return;
    setStatus("loading");
    setError(null);
    trackEvent("mood_request_submitted", {
      session_id: getOrCreateSessionId(),
      language_code: language || undefined,
      has_duration_target: targetMode === "duration",
      has_song_count_target: targetMode === "count",
    });
    try {
      const response = await fetch("/api/mood-assistant", {
        method: "POST",
        headers: { "content-type": "application/json", "x-cassetteplay-session": getOrCreateSessionId() },
        body: JSON.stringify({
          message: listenerMessage,
          selections: {
            ...(language ? { language } : {}),
            ...(targetMode === "duration" ? { durationMinutes } : { songCount }),
          },
          conversationContext: conversation.slice(-4),
          currentQueueIds: [...new Set([
            ...currentQueueIds,
            ...playedSongIds,
            ...(repeat ? result?.playlist.map((item) => item.song.id) ?? [] : []),
          ])],
        }),
      });
      const payload = await response.json() as MoodAssistantResponse | { ok: false; message?: string; code?: string };
      if (!response.ok || !payload.ok) throw new Error("message" in payload && payload.message ? payload.message : "Unable to create a playlist.");
      setResult(payload);
      setLastMessage(listenerMessage);
      setConversation((current) => [...current, { role: "listener" as const, content: listenerMessage }, { role: "assistant" as const, content: payload.assistantResponse }].slice(-4));
      if (payload.clarificationRequired) {
        trackEvent("mood_clarification_requested", { session_id: getOrCreateSessionId(), generation_id: payload.generationId });
      } else if (payload.playlist.length === 0) {
        trackEvent("mood_playlist_empty", { session_id: getOrCreateSessionId(), generation_id: payload.generationId });
      } else {
        trackEvent("mood_playlist_generated", {
          session_id: getOrCreateSessionId(),
          generation_id: payload.generationId,
          playlist_size: payload.playlist.length,
          playlist_duration_seconds: payload.playlistDurationSeconds,
          total_ms: Math.round(payload.timings.totalMs),
          provider_mode: payload.providerMode,
        });
      }
      if (payload.providerMode === "fallback") {
        trackEvent("mood_provider_fallback", { session_id: getOrCreateSessionId(), generation_id: payload.generationId });
      }
      setMessage("");
      setStatus("idle");
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : "Unable to create a playlist.";
      setError(messageText);
      setStatus("error");
      trackEvent("mood_generation_failed", { session_id: getOrCreateSessionId(), error_code: "generation_failed" });
    }
  };

  const playResult = () => {
    if (!result?.playlist.length) return;
    onActivate(result.playlist.map((item) => item.song), result.generationId);
    trackEvent(active ? "mood_playlist_refined" : "mood_playlist_started", active
      ? { session_id: getOrCreateSessionId(), generation_id: result.generationId, previous_size: currentQueueIds.length, new_size: result.playlist.length, retained_current: true }
      : { session_id: getOrCreateSessionId(), generation_id: result.generationId, playlist_size: result.playlist.length });
  };

  return (
    <section className="overflow-hidden rounded-lg border border-amber-200/25 bg-neutral-950/72 text-white shadow-xl shadow-black/20 backdrop-blur-md" aria-labelledby="mood-assistant-heading">
      <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-200">
        <span className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-amber-200" aria-hidden="true" /><span><strong id="mood-assistant-heading" className="block text-base">Mood Assistant</strong><span className="block text-xs text-white/60">Build a verified catalogue mix</span></span></span>
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <span className="text-sm font-bold text-amber-100">Open</span>}
      </button>

      {open ? <div className="border-t border-white/10 p-4">
        <label className="block text-sm font-bold" htmlFor="mood-assistant-input">What fits this moment?</label>
        <textarea
          ref={inputRef}
          id="mood-assistant-input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder={active ? "Refine this playlist..." : "I'm driving in the rain. Play Telugu melodies for 45 minutes."}
          className="mt-2 w-full resize-y rounded-md border border-white/20 bg-black/35 px-3 py-2 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Mood suggestions">
          {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setMessage((current) => current ? `${current} ${suggestion}` : suggestion); inputRef.current?.focus(); }} className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200">{suggestion}</button>)}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-white/70">Language
            <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className="mt-1 min-h-11 w-full rounded-md border border-white/20 bg-neutral-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-200">
              <option value="">Any language</option><option value="te">Telugu</option><option value="hi">Hindi</option><option value="en">English</option>
            </select>
          </label>
          <div>
            <div className="grid grid-cols-2 rounded-md border border-white/20 p-1" role="group" aria-label="Playlist target">
              <button type="button" onClick={() => setTargetMode("duration")} aria-pressed={targetMode === "duration"} className={`min-h-9 rounded-sm text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200 ${targetMode === "duration" ? "bg-amber-200 text-black" : "text-white/70"}`}>Minutes</button>
              <button type="button" onClick={() => setTargetMode("count")} aria-pressed={targetMode === "count"} className={`min-h-9 rounded-sm text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200 ${targetMode === "count" ? "bg-amber-200 text-black" : "text-white/70"}`}>Songs</button>
            </div>
            <label className="sr-only" htmlFor="mood-target-value">{targetMode === "duration" ? "Duration in minutes" : "Number of songs"}</label>
            <input id="mood-target-value" type="number" min={targetMode === "duration" ? 5 : 1} max={targetMode === "duration" ? 240 : 50} value={targetMode === "duration" ? durationMinutes : songCount} onChange={(event) => targetMode === "duration" ? setDurationMinutes(Number(event.target.value)) : setSongCount(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-md border border-white/20 bg-neutral-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
          </div>
        </div>

        <button type="button" onClick={() => void generate()} disabled={!message.trim() || status === "loading"} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-200 px-4 font-black text-neutral-950 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-50">
          {status === "loading" ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}
          {status === "loading" ? "Creating playlist" : active ? "Refine playlist" : "Create playlist"}
        </button>

        {error ? <p className="mt-3 text-sm font-semibold text-red-200" role="alert">{error}</p> : null}
        {result ? <div className="mt-5 border-t border-white/12 pt-4" aria-live="polite">
          <p className="text-sm font-semibold text-white/82">{result.assistantResponse}</p>
          {result.providerMode === "fallback" ? <p className="mt-2 text-xs text-amber-100">Using CassettePlay&apos;s deterministic matching while the AI interpreter is unavailable.</p> : null}
          {result.playlist.length > 0 ? <>
            <div className="mt-3 flex items-center justify-between text-xs text-white/58"><span>{result.playlist.length} songs</span><span>{durationLabel(result.playlistDurationSeconds)}</span></div>
            <ol className="mt-2 max-h-72 divide-y divide-white/10 overflow-y-auto">
              {result.playlist.map((item, index) => <li key={item.song.id} className="flex gap-3 py-3">
                <span className="w-5 shrink-0 text-xs font-bold text-white/45">{index + 1}</span>
                <span className="min-w-0"><strong className="block truncate text-sm">{item.song.title}</strong><span className="block truncate text-xs text-white/58">{item.song.singers.join(", ")}</span><span className="mt-1 block text-xs text-amber-100/80">{item.reason}</span></span>
              </li>)}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={playResult} className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-white font-black text-black focus:outline-none focus:ring-2 focus:ring-amber-200"><Play className="h-4 w-4" aria-hidden="true" />{active ? "Play update" : "Play"}</button>
              <button type="button" onClick={() => void generate(true)} disabled={status === "loading" || !lastMessage} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 font-bold focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true" />Regenerate</button>
            </div>
          </> : null}
        </div> : null}
      </div> : null}
    </section>
  );
}
