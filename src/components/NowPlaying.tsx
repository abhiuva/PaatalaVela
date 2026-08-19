import { Calendar, Clapperboard, Mic2, Music2 } from "lucide-react";
import type { Channel, Song } from "@/types/radio";

type NowPlayingProps = {
  channel: Channel;
  song: Song;
  pendingScheduledSwitch: boolean;
};

export function NowPlaying({ channel, song, pendingScheduledSwitch }: NowPlayingProps) {
  return (
    <section
      className="rounded-lg border border-white/15 bg-black/35 p-4 text-white shadow-2xl shadow-black/25 backdrop-blur-md sm:p-5"
      aria-labelledby="now-playing-heading"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Now Playing</p>
          <h2 id="now-playing-heading" className="mt-2 break-words text-3xl font-black leading-tight sm:text-4xl">
            {song.title}
          </h2>
          <p className="mt-2 font-[var(--font-noto-telugu)] text-2xl font-bold text-white/90">{channel.teluguName}</p>
        </div>
        <div className="hidden rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-black sm:block" style={{ backgroundColor: channel.palette.accent }}>
          {channel.mood}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 text-sm text-white/84 sm:grid-cols-2">
        <div className="flex gap-3">
          <Clapperboard className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <div>
            <dt className="text-white/50">Film</dt>
            <dd className="font-semibold">{song.film}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <div>
            <dt className="text-white/50">Year</dt>
            <dd className="font-semibold">{song.year}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Mic2 className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <div>
            <dt className="text-white/50">Singers</dt>
            <dd className="font-semibold">{song.singers.join(", ")}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <div>
            <dt className="text-white/50">Composer</dt>
            <dd className="font-semibold">{song.composer}</dd>
          </div>
        </div>
      </dl>

      {pendingScheduledSwitch ? (
        <p className="mt-3 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white">
          The schedule has moved on. This song will finish, then the next scheduled channel will load.
        </p>
      ) : null}
    </section>
  );
}
