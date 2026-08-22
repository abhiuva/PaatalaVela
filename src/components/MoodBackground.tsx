import type { Channel } from "@/types/radio";

type MoodBackgroundProps = {
  channel: Channel;
};

export function MoodBackground({ channel }: MoodBackgroundProps) {
  const artwork = channel.backgroundImageUrl ? `, url(${JSON.stringify(channel.backgroundImageUrl)})` : "";
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-neutral-950"
      style={{
        backgroundColor: channel.palette.from,
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.82)), linear-gradient(135deg, ${channel.palette.from}cc, ${channel.palette.via}b8 48%, ${channel.palette.to}d9)${artwork}`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      aria-hidden="true"
    >
      <div className="kolam-pattern absolute inset-0 opacity-[0.16]" />
    </div>
  );
}
