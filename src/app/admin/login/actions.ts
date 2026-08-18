"use server";

import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function loginAction(_previousState: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseAuthServerClient();
  const serviceClient = createServiceSupabaseClient();

  if (!supabase || !serviceClient) {
    return "Admin login is not configured. Add the public Supabase env vars and server-only service role key.";
  }

  if (!email || !password) {
    return "Email and password are required.";
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status && error.status >= 500) {
      return "Supabase is currently unreachable. Try again after confirming the project is available.";
    }
    return "Unable to sign in with those credentials.";
  }

  redirect("/admin");
}
