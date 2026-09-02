import Link from "next/link";
import { BRAND } from "@/config/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 px-4 text-white">
      <section className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/55">{BRAND.name}</p>
        <h1 className="mt-3 text-4xl font-black">Page not found</h1>
        <Link href="/" className="mt-6 inline-block rounded-md border border-white/25 px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-white">Return to radio</Link>
      </section>
    </main>
  );
}
