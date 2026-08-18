import { channels } from "@/data/channels";
import type { Channel, ChannelId, TimeRange } from "@/types/radio";

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
  const channel = list.find((item) => isHourInRange(hour, item.schedule));

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

export function getNextChannel(channelId: ChannelId, list: Channel[] = channels): Channel {
  const index = list.findIndex((channel) => channel.id === channelId);

  if (index === -1) {
    throw new Error(`Unknown channel ${channelId}`);
  }

  return list[(index + 1) % list.length];
}

export function getChannelById(channelId: ChannelId, list: Channel[] = channels): Channel {
  const channel = list.find((item) => item.id === channelId);

  if (!channel) {
    throw new Error(`Unknown channel ${channelId}`);
  }

  return channel;
}

export function formatScheduleRange(range: TimeRange): string {
  const format = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  return `${format(range.startHour)}-${format(range.endHour)}`;
}
