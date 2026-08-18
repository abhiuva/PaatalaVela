import type { Channel } from "@/types/radio";

type MoodBackgroundProps = {
  channel: Channel;
};

export function MoodBackground({ channel }: MoodBackgroundProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-neutral-950"
      style={{
        background: `linear-gradient(135deg, ${channel.palette.from}, ${channel.palette.via} 48%, ${channel.palette.to})`,
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.22),transparent_24%),radial-gradient(circle_at_80%_10%,rgba(255,226,153,0.18),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.72))]" />
      <div className="kolam-pattern absolute inset-0 opacity-[0.16]" />
      <div className="absolute -left-24 top-20 h-64 w-64 rounded-full border border-white/20" />
      <div className="absolute bottom-20 right-[-5rem] h-80 w-80 rounded-full border border-white/15" />
      <div className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 motion-safe:animate-[slow-spin_42s_linear_infinite]" />
    </div>
  );
}
