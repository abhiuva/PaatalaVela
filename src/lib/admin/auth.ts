import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { DbAdminProfile } from "@/types/database";
import { isActiveAdministrator } from "@/lib/admin/authorization";

export type AdminContext =
  | { status: "ok"; userId: string; profile: DbAdminProfile }
  | { status: "setup"; message: string }
  | { status: "unauthorized"; message: string };

export async function getAdminContext(): Promise<AdminContext> {
  const authClient = await createSupabaseAuthServerClient();
  const serviceClient = createServiceSupabaseClient();

  if (!authClient || !serviceClient) {
    return {
      status: "setup",
      message: "Supabase admin configuration is incomplete. Configure public Supabase env vars and the server-only service-role key.",
    };
  }

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await serviceClient
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!isActiveAdministrator(profile)) {
    return {
      status: "unauthorized",
      message: "This account is not authorized for the administration console.",
    };
  }

  return {
    status: "ok",
    userId: user.id,
    profile,
  };
}
