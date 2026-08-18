import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminContext } from "@/lib/admin/auth";
import { logoutAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const context = await getAdminContext();

  if (context.status !== "ok") {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
        <section className="mx-auto max-w-2xl rounded-lg border border-white/15 bg-white/8 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">{context.status === "setup" ? "Setup required" : "Unauthorized"}</p>
          <h1 className="mt-3 text-3xl font-black">Admin access unavailable</h1>
          <p className="mt-3 leading-7 text-white/75">{context.message}</p>
          <Link href="/" className="mt-6 inline-block font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white">
            Back to radio
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 bg-black/35 px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-lg font-black focus:outline-none focus:ring-2 focus:ring-white">
              Telugu Radio Admin
            </Link>
            <p className="text-xs text-white/55">{context.profile.display_name} · {context.profile.role}</p>
          </div>
          <nav className="hidden gap-3 text-sm font-semibold text-white/75 md:flex" aria-label="Admin sections">
            <Link href="/admin/analytics" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-white">Analytics</Link>
            <Link href="/admin/sponsors" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-white">Sponsors</Link>
            <Link href="/admin/song-requests" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-white">Requests</Link>
            <Link href="/admin#youtube-imports" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-white">YouTube Imports</Link>
            <Link href="/admin/health" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-white">Health</Link>
          </nav>
          <form action={logoutAction}>
            <button className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white">
              Logout
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
