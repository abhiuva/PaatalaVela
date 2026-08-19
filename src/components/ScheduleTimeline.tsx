import type { Channel, ChannelSlug } from "@/types/radio";
import { formatScheduleRange } from "@/lib/schedule";

type ScheduleTimelineProps = {
  channels: Channel[];
  activeChannelSlug: ChannelSlug;
  nextChannelSlug: ChannelSlug;
};

export function ScheduleTimeline({ channels, activeChannelSlug, nextChannelSlug }: ScheduleTimelineProps) {
  return (
    <section className="space-y-3" aria-labelledby="schedule-heading">
      <h2 id="schedule-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
        Daily Schedule
      </h2>
      <ol className="relative space-y-3 border-l border-white/20 pl-4">
        {channels.map((channel) => (
          <li key={channel.slug} className="relative">
            <span
              className="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full border border-white/60"
              style={{ backgroundColor: channel.slug === activeChannelSlug ? channel.palette.accent : "rgba(255,255,255,0.25)" }}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-black/22 px-3 py-2 text-white backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{channel.name}</p>
                <p className="truncate font-[var(--font-noto-telugu)] text-sm text-white/70">{channel.teluguName}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <span>{channel.scheduled ? formatScheduleRange(channel.schedule) : "On demand"}</span>
                {channel.slug === activeChannelSlug ? <span className="rounded-full bg-white px-2 py-0.5 text-black">Active</span> : null}
                {channel.slug === nextChannelSlug ? <span className="rounded-full border border-white/30 px-2 py-0.5 text-white">Next</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
