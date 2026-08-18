"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/admin/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-md bg-white px-4 font-bold text-black transition hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60"
    >
      {pending ? "Signing in" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [error, formAction] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-semibold text-white/80">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white"
        />
      </label>
      <label className="block text-sm font-semibold text-white/80">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white"
        />
      </label>
      {error ? <p className="rounded-md border border-red-200/30 bg-red-400/12 px-3 py-2 text-sm text-red-50">{error}</p> : null}
      <SubmitButton />
    </form>
  );
}
