"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
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
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [error, formAction] = useActionState(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

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
      <div>
        <label htmlFor="admin-password" className="block text-sm font-semibold text-white/80">Password</label>
        <span className="relative mt-1 block">
          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-white/65 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </span>
      </div>
      {error ? <p role="alert" className="rounded-md border border-red-200/30 bg-red-400/12 px-3 py-2 text-sm text-red-50">{error}</p> : null}
      <SubmitButton />
    </form>
  );
}
