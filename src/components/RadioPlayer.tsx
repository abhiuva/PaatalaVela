"use client";

import { ExternalLink, Pause, Play, Share2, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { ChannelSelector } from "@/components/ChannelSelector";
import { Footer } from "@/components/Footer";
import { MoodBackground } from "@/components/MoodBackground";
import { NowPlaying } from "@/components/NowPlaying";
import { ScheduleTimeline } from "@/components/ScheduleTimeline";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { ConsentBanner } from "@/components/privacy/ConsentBanner";
import { SponsorPlacement } from "@/components/sponsor/SponsorPlacement";
import { useIndiaTime } from "@/hooks/useIndiaTime";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useRadioPlayer } from "@/hooks/useRadioPlayer";
import { formatScheduleRange } from "@/lib/schedule";
import { getOrCreateSessionId, trackEvent } from "@/lib/analytics/client";
import { useSponsors } from "@/hooks/useSponsors";
import { useEffect } from "react";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

export function RadioPlayer() {
  const { now, formattedTime, formattedDate } = useIndiaTime();
  const catalogue = useCatalogue();
  const sponsors = useSponsors();
  const radio = useRadioPlayer(now, catalogue.channels);
  const canPlayCurrentSong = Boolean(radio.song) && !radio.song.placeholder && catalogue.source === "supabase";
  const youtubeUrl = radio.song ? `https://www.youtube.com/watch?v=${radio.song.youtubeVideoId}` : "#";
  const shareText = encodeURIComponent(
    `Listening to ${radio.channel.name} on Telugu Radio${radio.song ? `: ${radio.song.title} (${radio.song.film}) ${youtubeUrl}` : "."}`,
  );

  useEffect(() => {
    if (!window.sessionStorage.getItem("telugu-radio-session")) {
      window.sessionStorage.setItem("telugu-radio-session", getOrCreateSessionId());
    }
  }, []);

  return (
    <>
      <MoodBackground channel={radio.channel} />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 text-white sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/68">Telugu Music Radio</p>
            <h1 className="mt-2 break-words font-[var(--font-noto-telugu)] text-5xl font-black leading-none sm:text-7xl">
              పాటల వేళ
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/78">{radio.channel.strapline}</p>
            {catalogue.isLoading ? (
              <p className="mt-3 inline-flex rounded-full border border-white/18 bg-black/22 px-3 py-1 text-xs font-semibold text-white/72">
                Loading production catalogue
              </p>
            ) : catalogue.source === "local" ? (
              <p className="mt-3 max-w-2xl rounded-md border border-amber-200/30 bg-amber-300/12 px-3 py-2 text-sm font-medium text-amber-50">
                {catalogue.fallbackReason} {catalogue.diagnosticCode ? `(${catalogue.diagnosticCode})` : ""}
              </p>
            ) : !radio.song ? (
              <p className="mt-3 max-w-2xl rounded-md border border-amber-200/30 bg-amber-300/12 px-3 py-2 text-sm font-medium text-amber-50">
                No playable songs are assigned to this channel yet. {catalogue.diagnosticCode ? `(${catalogue.diagnosticCode})` : "(CHANNEL_EMPTY)"}
              </p>
            ) : radio.fallbackReason ? (
              <p className="mt-3 max-w-2xl rounded-md border border-amber-200/30 bg-amber-300/12 px-3 py-2 text-sm font-medium text-amber-50">
                {radio.fallbackReason}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-white/15 bg-black/28 p-4 text-left shadow-xl shadow-black/20 backdrop-blur sm:min-w-64 sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/58">India Time</p>
            <time dateTime={now.toISOString()} className="mt-1 block text-3xl font-black tabular-nums">
              {formattedTime}
            </time>
            <p className="text-sm text-white/70">{formattedDate} IST</p>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <section className="min-w-0 space-y-5">
            {radio.song ? (
              <NowPlaying channel={radio.channel} song={radio.song} pendingScheduledSwitch={radio.pendingScheduledSwitch} />
            ) : (
              <section className="rounded-lg border border-white/15 bg-black/30 p-5 shadow-2xl shadow-black/20 backdrop-blur-md" aria-label="No song assigned">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/58">Now Playing</p>
                <h2 className="mt-3 text-3xl font-black">No playable songs assigned</h2>
                <p className="mt-2 text-white/70">Add an active, available Supabase song to {radio.channel.name} to enable playback.</p>
              </section>
            )}

            <section className="rounded-lg border border-white/15 bg-black/30 p-4 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-5" aria-label="Playback controls">
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={radio.previousTrack}
                  disabled={!canPlayCurrentSong}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 font-bold text-white transition hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Previous song"
                >
                  <SkipBack className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <button
                  type="button"
                  onClick={radio.togglePlayback}
                  disabled={!canPlayCurrentSong}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-md px-3 font-black text-black transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white"
                  style={{ backgroundColor: radio.channel.palette.accent }}
                  aria-label={radio.isPlaying ? "Pause radio" : "Start radio"}
                >
                  {radio.isPlaying ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
                  <span>{radio.isPlaying ? "Pause" : "Start"}</span>
                </button>
                <button
                  type="button"
                  onClick={radio.nextTrack}
                  disabled={!canPlayCurrentSong}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 font-bold text-white transition hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Next song"
                >
                  <span className="hidden sm:inline">Next</span>
                  <SkipForward className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-white/82">
                <Volume2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="sr-only">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={radio.volume}
                  onChange={(event) => radio.setVolume(Number(event.target.value))}
                  className="w-full accent-white focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Volume"
                />
                <span className="w-10 text-right tabular-nums">{radio.volume}%</span>
              </label>

              {radio.manualChannelId || radio.listenerOffset ? (
                <button
                  type="button"
                  onClick={radio.resumeSchedule}
                  className="mt-4 w-full rounded-md border border-white/30 bg-white/12 px-3 py-2 text-sm font-black text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  Return to Live Radio
                </button>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!canPlayCurrentSong}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={(event) => {
                    if (!canPlayCurrentSong || !radio.song) {
                      event.preventDefault();
                      return;
                    }
                    trackEvent("youtube_source_clicked", {
                      session_id: window.sessionStorage.getItem("telugu-radio-session") ?? "session_unset",
                      song_id: radio.song.id,
                      channel_id: radio.channel.id,
                    });
                  }}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open on YouTube
                </a>
                <a
                  href={`https://wa.me/?text=${shareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!canPlayCurrentSong}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={(event) => {
                    if (!canPlayCurrentSong || !radio.song) {
                      event.preventDefault();
                      return;
                    }
                    trackEvent("whatsapp_share_clicked", {
                      session_id: window.sessionStorage.getItem("telugu-radio-session") ?? "session_unset",
                      song_id: radio.song.id,
                      channel_id: radio.channel.id,
                    });
                  }}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Share
                </a>
              </div>
            </section>

            {canPlayCurrentSong && radio.song ? (
              <YouTubePlayer
                videoId={radio.song.youtubeVideoId}
                isPlaying={radio.isPlaying}
                hasUserInteracted={radio.hasUserInteracted}
                volume={radio.volume}
                seekSeconds={radio.seekSeconds}
                seekRevision={radio.seekRevision}
                onReady={radio.handlePlayerReady}
                onEnded={radio.handleEnded}
                onError={radio.handlePlayerError}
                onPositionChange={radio.handlePositionChange}
              />
            ) : (
              <section className="rounded-lg border border-white/15 bg-black/30 p-4 text-sm text-white/70 backdrop-blur-md" aria-label="Player unavailable">
                The YouTube player will appear after this Supabase channel has an active, available song assignment.
              </section>
            )}
            <SponsorPlacement campaigns={sponsors} channelId={radio.channel.id} placementType="now_playing" />
          </section>

          <aside className="min-w-0 space-y-5">
            <section className="rounded-lg border border-white/15 bg-black/28 p-4 shadow-xl shadow-black/20 backdrop-blur-md" aria-label="Current channel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/58">Current Channel</p>
              <h2 className="mt-2 text-2xl font-black">{radio.channel.name}</h2>
              <p className="font-[var(--font-noto-telugu)] text-xl text-white/82">{radio.channel.teluguName}</p>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/78">
                <div>
                  <dt className="text-white/48">Slot</dt>
                  <dd className="font-semibold">{formatScheduleRange(radio.channel.schedule)} IST</dd>
                </div>
                <div>
                  <dt className="text-white/48">Next channel</dt>
                  <dd className="font-semibold">{radio.nextChannel.name}</dd>
                </div>
                <div>
                  <dt className="text-white/48">Playback mode</dt>
                  <dd className="font-semibold">{radio.playbackMode === "live" ? "Scheduled live" : "Manual sequential"}</dd>
                </div>
              </dl>
            </section>

            <ChannelSelector
              channels={radio.channels}
              activeChannelId={radio.channel.id}
              scheduledChannelId={radio.scheduledChannel.id}
              manualChannelId={radio.manualChannelId}
              onSelect={radio.selectChannel}
              onResumeSchedule={radio.resumeSchedule}
            />

            <ScheduleTimeline channels={radio.channels} activeChannelId={radio.channel.id} nextChannelId={radio.nextChannel.id} />

            <SponsorPlacement campaigns={sponsors} channelId={radio.channel.id} placementType="channel" />
          </aside>
        </div>

        <Footer />
      </main>
      <FeedbackButton channelId={radio.channel.id} songId={radio.song?.id} appVersion={process.env.NEXT_PUBLIC_APP_VERSION} />
      <ConsentBanner />
    </>
  );
}
