import { describe, expect, it } from "vitest";
import { channels } from "@/data/channels";
import { getChannelForHour, isHourInRange } from "@/lib/schedule";

describe("schedule boundaries", () => {
  it.each([
    [5, "suprabhata-melodies"],
    [8, "suprabhata-melodies"],
    [9, "tea-shop-classics"],
    [12, "tea-shop-classics"],
    [13, "ilaiyaraaja-era"],
    [16, "ilaiyaraaja-era"],
    [17, "prema-viraham"],
    [20, "prema-viraham"],
    [21, "mass-beat-centre"],
    [22, "mass-beat-centre"],
    [23, "highway-ratri"],
    [0, "highway-ratri"],
    [4, "highway-ratri"],
  ])("selects %s:00 as %s", (hour, expectedChannelId) => {
    expect(getChannelForHour(hour).id).toBe(expectedChannelId);
  });

  it.each([
    [4, "suprabhata-melodies", false],
    [5, "suprabhata-melodies", true],
    [8, "suprabhata-melodies", true],
    [9, "suprabhata-melodies", false],
    [22, "mass-beat-centre", true],
    [23, "mass-beat-centre", false],
    [23, "highway-ratri", true],
    [0, "highway-ratri", true],
    [4, "highway-ratri", true],
    [5, "highway-ratri", false],
  ])("handles range membership for %s:00 in %s", (hour, channelId, expected) => {
    const channel = channels.find((item) => item.id === channelId);
    expect(channel).toBeDefined();
    expect(isHourInRange(hour, channel!.schedule)).toBe(expected);
  });

  it("covers every hour exactly once", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const matchingChannels = channels.filter((channel) => isHourInRange(hour, channel.schedule));
      expect(matchingChannels).toHaveLength(1);
    }
  });
});
