import { channels } from "@/data/channels";
import type { Channel, ChannelSlug, TimeRange } from "@/types/radio";

export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function isHourInRange(hour: number, range: TimeRange): boolean {
  if (range.startHour === range.endHour) {
    return true;
  }

  if (range.startHour < range.endHour) {
    return hour >= range.startHour && hour < range.endHour;
  }

  return hour >= range.startHour || hour < range.endHour;
}

export function getChannelForHour(hour: number, list: Channel[] = channels): Channel {
  const channel = list.find((item) => item.scheduled && isHourInRange(hour, item.schedule));

  if (!channel) {
    throw new Error(`No channel configured for hour ${hour}`);
  }

  return channel;
}

export function getIndiaHour(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  });

  const value = formatter.format(date);
  return Number(value === "24" ? "0" : value);
}

export function getScheduledChannel(date: Date, list: Channel[] = channels): Channel {
  return getChannelForHour(getIndiaHour(date), list);
}

export function getNextChannel(channelSlug: ChannelSlug, list: Channel[] = channels): Channel {
  const scheduledChannels = list.filter((channel) => channel.scheduled);
  const index = scheduledChannels.findIndex((channel) => channel.slug === channelSlug);

  if (index === -1) {
    return scheduledChannels[0] ?? list[0];
  }

  return scheduledChannels[(index + 1) % scheduledChannels.length];
}

export function getChannelBySlug(channelSlug: ChannelSlug, list: Channel[] = channels): Channel {
  const channel = list.find((item) => item.slug === channelSlug);

  if (!channel) {
    throw new Error(`Unknown channel ${channelSlug}`);
  }

  return channel;
}

export function formatScheduleRange(range: TimeRange): string {
  const format = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  return `${format(range.startHour)}-${format(range.endHour)}`;
}
