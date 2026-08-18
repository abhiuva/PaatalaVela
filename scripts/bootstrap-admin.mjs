#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return false;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
  return true;
}

function requireEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function validatePassword(password) {
  if (password.length < 12) return "ADMIN_PASSWORD must be at least 12 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "ADMIN_PASSWORD must include uppercase, lowercase and numeric characters.";
  }
  return null;
}

async function findUserByEmail(service, email) {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Unable to search auth users: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error("Unable to finish auth user search within 100 pages.");
}

async function main() {
  loadEnvLocal();

  let url;
  let anonKey;
  let serviceRoleKey;
  let email;
  let password;
  let displayName;
  try {
    url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    email = requireEnv("ADMIN_EMAIL").toLowerCase();
    password = requireEnv("ADMIN_PASSWORD");
    displayName = requireEnv("ADMIN_DISPLAY_NAME");
  } catch (error) {
    console.error(error.message);
    console.error("Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Use-A-Strong-Password-123' ADMIN_DISPLAY_NAME='Admin Name' npm run admin:bootstrap");
    process.exitCode = 1;
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    console.error(passwordError);
    process.exitCode = 1;
    return;
  }

  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(url, serviceRoleKey, clientOptions);
  const anon = createClient(url, anonKey, clientOptions);

  let user = await findUserByEmail(service, email);
  let created = false;
  if (!user) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) {
      throw new Error(`Unable to create admin auth user: ${error?.message ?? "unknown error"}`);
    }
    user = data.user;
    created = true;
  }

  const { error: profileError } = await service.from("admin_profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      role: "admin",
      active: true,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw new Error(`Unable to upsert admin profile: ${profileError.message}`);
  }

  const { data: loginData, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  if (loginError || !loginData.user) {
    throw new Error(`Admin password verification failed: ${loginError?.message ?? "unknown error"}`);
  }

  const { data: profile, error: verifyError } = await service
    .from("admin_profiles")
    .select("role,active")
    .eq("id", loginData.user.id)
    .single();
  await anon.auth.signOut();

  if (verifyError || profile?.role !== "admin" || profile?.active !== true) {
    throw new Error(`Admin profile verification failed: ${verifyError?.message ?? "profile is not active admin"}`);
  }

  console.log("Admin bootstrap complete.");
  console.log(`Auth user: ${created ? "created" : "already existed"}`);
  console.log("Admin profile: active admin");
  console.log("Login check: passed");
  console.log(`Admin email: ${email}`);
  console.log("Password: supplied via ADMIN_PASSWORD and not displayed");
  console.log("Admin URL: http://localhost:3000/admin/login");
}

main().catch((error) => {
  console.error(`Admin bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
