import Link from "next/link";
import { LoginForm } from "@/app/admin/login/LoginForm";
import { BRAND } from "@/config/brand";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <section className="mx-auto max-w-md rounded-lg border border-white/15 bg-white/8 p-6 shadow-2xl shadow-black/30">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">{BRAND.name} Admin</p>
        <h1 className="mt-3 text-3xl font-black">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">Use a Supabase email/password account that already has an active admin profile.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-white/70 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white">
          Back to radio
        </Link>
      </section>
    </main>
  );
}
