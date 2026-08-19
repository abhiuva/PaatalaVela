"use client";

import { Radio } from "lucide-react";
import type { Channel, ChannelSlug } from "@/types/radio";
import { formatScheduleRange } from "@/lib/schedule";

type ChannelSelectorProps = {
  channels: Channel[];
  activeChannelSlug: ChannelSlug;
  scheduledChannelSlug: ChannelSlug;
  manualChannelSlug: ChannelSlug | null;
  onSelect: (channelSlug: ChannelSlug) => void;
  onResumeSchedule: () => void;
};

export function ChannelSelector({
  channels,
  activeChannelSlug,
  scheduledChannelSlug,
  manualChannelSlug,
  onSelect,
  onResumeSchedule,
}: ChannelSelectorProps) {
  return (
    <section className="space-y-3" aria-labelledby="channels-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="channels-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
          Channels
        </h2>
        {manualChannelSlug ? (
          <button
            type="button"
            onClick={onResumeSchedule}
            className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Return to Live Radio
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {channels.map((channel) => {
          const isActive = channel.slug === activeChannelSlug;
          const isScheduled = channel.slug === scheduledChannelSlug;

          return (
            <button
              key={channel.slug}
              type="button"
              onClick={() => onSelect(channel.slug)}
              aria-pressed={isActive}
              className="group min-w-0 rounded-lg border border-white/15 bg-black/22 p-3 text-left text-white shadow-lg shadow-black/10 backdrop-blur transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white data-[active=true]:border-white/70 data-[active=true]:bg-white/18"
              data-active={isActive}
            >
              <span className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                {channel.scheduled ? formatScheduleRange(channel.schedule) : "On demand"}
                {isScheduled ? <span className="text-white">Live slot</span> : null}
              </span>
              <span className="mt-2 block truncate text-base font-bold">{channel.name}</span>
              <span className="mt-0.5 block truncate font-[var(--font-noto-telugu)] text-lg text-white/90">
                {channel.teluguName}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
