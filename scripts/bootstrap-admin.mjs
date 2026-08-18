#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export function loadEnvLocal(target = process.env, cwd = process.cwd()) {
  const envPath = path.join(cwd, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    target[match[1]] ??= value;
  }
}

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`ADMIN_BOOTSTRAP_MISSING_${key}`);
  return value;
}

export function validateBootstrapInput(env) {
  const email = required(env, "ADMIN_EMAIL").toLowerCase();
  const password = required(env, "ADMIN_PASSWORD");
  const displayName = required(env, "ADMIN_DISPLAY_NAME");
  const url = required(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_BOOTSTRAP_INVALID_EMAIL");
  if (password.length < 12) throw new Error("ADMIN_BOOTSTRAP_PASSWORD_TOO_SHORT");
  if (displayName.length > 100) throw new Error("ADMIN_BOOTSTRAP_DISPLAY_NAME_TOO_LONG");
  return { email, password, displayName, url, serviceRoleKey };
}

async function findExactUsersByEmail(service, email) {
  const matches = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("ADMIN_BOOTSTRAP_AUTH_SEARCH_FAILED");
    matches.push(...data.users.filter((user) => user.email?.toLowerCase() === email));
    if (data.users.length < 100) break;
  }
  if (matches.length > 1) throw new Error("ADMIN_BOOTSTRAP_MULTIPLE_AUTH_USERS");
  return matches[0] ?? null;
}

export async function runBootstrap({ env = process.env, createClientImpl = createClient, output = console.log } = {}) {
  const { email, password, displayName, url, serviceRoleKey } = validateBootstrapInput(env);
  const service = createClientImpl(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let user = await findExactUsersByEmail(service, email);
  const created = !user;

  if (!user) {
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (error || !data.user) throw new Error("ADMIN_BOOTSTRAP_AUTH_CREATE_FAILED");
    user = data.user;
  } else {
    const { data, error } = await service.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (error || !data.user) throw new Error("ADMIN_BOOTSTRAP_AUTH_UPDATE_FAILED");
    user = data.user;
  }

  const { error: profileError } = await service.from("admin_profiles").upsert({ id: user.id, display_name: displayName, role: "admin", active: true }, { onConflict: "id" });
  if (profileError) throw new Error("ADMIN_BOOTSTRAP_PROFILE_UPSERT_FAILED");
  const { data: profile, error: verifyError } = await service.from("admin_profiles").select("id, role, active").eq("id", user.id).maybeSingle();
  if (verifyError || profile?.id !== user.id || profile.role !== "admin" || profile.active !== true) throw new Error("ADMIN_BOOTSTRAP_PROFILE_VERIFY_FAILED");

  output(created ? "Auth user created" : "Auth user found");
  output("Password configured");
  output("Email confirmed");
  output("Admin profile verified");
  output("Login URL: http://localhost:3000/admin/login");
  return { created };
}

async function main() {
  loadEnvLocal();
  try {
    await runBootstrap();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "ADMIN_BOOTSTRAP_FAILED");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
