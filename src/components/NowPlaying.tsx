"use client";

/* eslint-disable @next/next/no-img-element */

import { Calendar, Clapperboard, Disc3, Mic2, Music2 } from "lucide-react";
import { useState } from "react";
import type { Channel, Song } from "@/types/radio";

type NowPlayingProps = { channel: Channel; song: Song; pendingScheduledSwitch: boolean };

export function NowPlaying({ channel, song, pendingScheduledSwitch }: NowPlayingProps) {
  const [artworkFailed, setArtworkFailed] = useState(false);
  const showArtwork = Boolean(song.thumbnailUrl) && !artworkFailed;
  const facts = [
    song.film ? { label: "Film", value: song.film, Icon: Clapperboard } : null,
    song.year ? { label: "Year", value: String(song.year), Icon: Calendar } : null,
    song.singers.length ? { label: song.singers.length === 1 ? "Singer" : "Singers", value: song.singers.join(", "), Icon: Mic2 } : null,
    song.composer ? { label: "Composer", value: song.composer, Icon: Music2 } : null,
  ].filter((fact): fact is NonNullable<typeof fact> => Boolean(fact));

  return (
    <section className="overflow-hidden rounded-lg border border-white/15 bg-black/35 text-white shadow-2xl shadow-black/25 backdrop-blur-md" aria-labelledby="now-playing-heading">
      <div className="grid gap-0 sm:grid-cols-[minmax(12rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="relative aspect-square min-h-56 overflow-hidden bg-black/35" aria-label={showArtwork ? `Artwork for ${song.title}` : `Artwork unavailable for ${song.title}`}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/7 text-white/55">
            <Disc3 className="h-16 w-16" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">Artwork unavailable</span>
          </div>
          {showArtwork ? <img src={song.thumbnailUrl!} alt={`Artwork for ${song.title}`} onError={() => setArtworkFailed(true)} className="absolute inset-0 h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Now Playing</p>
          <h2 id="now-playing-heading" className="mt-2 break-words text-3xl font-black leading-tight sm:text-4xl">{song.title}</h2>
          {facts.length ? <dl className="mt-5 grid grid-cols-1 gap-3 text-sm text-white/84 sm:grid-cols-2">
            {facts.map(({ label, value, Icon }) => <div key={label} className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" /><div className="min-w-0"><dt className="text-white/50">{label}</dt><dd className="break-words font-semibold">{value}</dd></div></div>)}
          </dl> : null}
          {song.story ? <p className="mt-5 border-l-2 pl-3 text-sm font-semibold leading-6 text-white/88" style={{ borderColor: channel.palette.accent }}>{song.story}</p> : null}
          {song.context ? <p className="mt-3 text-sm leading-6 text-white/68">{song.context}</p> : null}
          {pendingScheduledSwitch ? <p className="mt-4 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium">The schedule has moved on. This song will finish, then the next scheduled channel will load.</p> : null}
        </div>
      </div>
    </section>
  );
}
