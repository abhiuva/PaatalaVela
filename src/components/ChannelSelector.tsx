"use client";

import { Radio } from "lucide-react";
import type { Channel, ChannelId } from "@/types/radio";
import { formatScheduleRange } from "@/lib/schedule";

type ChannelSelectorProps = {
  channels: Channel[];
  activeChannelId: ChannelId;
  scheduledChannelId: ChannelId;
  manualChannelId: ChannelId | null;
  onSelect: (channelId: ChannelId) => void;
  onResumeSchedule: () => void;
};

export function ChannelSelector({
  channels,
  activeChannelId,
  scheduledChannelId,
  manualChannelId,
  onSelect,
  onResumeSchedule,
}: ChannelSelectorProps) {
  return (
    <section className="space-y-3" aria-labelledby="channels-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="channels-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
          Channels
        </h2>
        {manualChannelId ? (
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
          const isActive = channel.id === activeChannelId;
          const isScheduled = channel.id === scheduledChannelId;

          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel.id)}
              aria-pressed={isActive}
              className="group min-w-0 rounded-lg border border-white/15 bg-black/22 p-3 text-left text-white shadow-lg shadow-black/10 backdrop-blur transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white data-[active=true]:border-white/70 data-[active=true]:bg-white/18"
              data-active={isActive}
            >
              <span className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-white/60">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                {formatScheduleRange(channel.schedule)}
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
