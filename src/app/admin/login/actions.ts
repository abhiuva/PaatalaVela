"use server";

import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { GENERIC_LOGIN_ERROR, isActiveAdministrator } from "@/lib/admin/authorization";

export async function loginAction(_previousState: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseAuthServerClient();
  const serviceClient = createServiceSupabaseClient();

  if (!supabase || !serviceClient) {
    return GENERIC_LOGIN_ERROR;
  }

  if (!email || !password) {
    return GENERIC_LOGIN_ERROR;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return GENERIC_LOGIN_ERROR;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await supabase.auth.signOut();
    return GENERIC_LOGIN_ERROR;
  }
  const { data: profile } = await serviceClient.from("admin_profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!isActiveAdministrator(profile)) {
    await supabase.auth.signOut();
    return GENERIC_LOGIN_ERROR;
  }

  redirect("/admin");
}
