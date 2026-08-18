import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getPublicSupabaseEnv, getServerSecretEnv } from "@/lib/env";

export function createPublicSupabaseServerClient() {
  const { url, anonKey } = getPublicSupabaseEnv();

  if (!url || !anonKey) {
    return null;
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServiceSupabaseClient() {
  const { url } = getPublicSupabaseEnv();
  const { serviceRoleKey } = getServerSecretEnv();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
