import Link from "next/link";
import { BRAND } from "@/config/brand";

export default function RightsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <article className="mx-auto max-w-3xl space-y-4 rounded-lg border border-white/15 bg-white/8 p-5">
        <h1 className="text-3xl font-black">Rights and Takedown</h1>
        <p>This operational template requires professional legal review before commercial launch.</p>
        <p>Audio and video play through YouTube’s embedded player. {BRAND.name} does not host copyrighted music. Rights remain with the relevant owners.</p>
        <p>YouTube and the video owner control embedded-video advertising revenue. Attribution on this site does not transfer ownership or imply that every singer personally receives revenue from every play.</p>
        <p>Rights holders may submit a removal request for review.</p>
        <Link href="/takedown" className="font-bold underline underline-offset-4">Submit a takedown request</Link>
      </article>
    </main>
  );
}
