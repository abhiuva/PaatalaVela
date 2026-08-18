#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const LOGIN_URL = "http://localhost:3000/admin/login";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function loadEnvLocal() {
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

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function validateResetInput(env) {
  const url = required(env, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const email = required(env, "ADMIN_EMAIL").toLowerCase();
  const password = required(env, "ADMIN_NEW_PASSWORD");

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_NEW_PASSWORD must be at least 12 characters");
  }

  return { url, serviceRoleKey, email, password };
}

export async function findExactUsersByEmail(service, email) {
  const matches = [];
  const normalized = email.toLowerCase();

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw new Error("Unable to search auth users");
    }

    for (const user of data.users) {
      if (user.email?.toLowerCase() === normalized) {
        matches.push(user);
      }
    }

    if (data.users.length < 100) break;
  }

  return matches;
}

async function verifyAdminProfile(service, userId) {
  const { data, error } = await service
    .from("admin_profiles")
    .select("id,role,active")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Admin profile verification failed: profile is missing");
  }
  if (data.role !== "admin") {
    throw new Error("Admin profile verification failed: profile role is not admin");
  }
  if (data.active !== true) {
    throw new Error("Admin profile verification failed: profile is inactive");
  }
}

export async function runResetAdminPassword({ env, createSupabaseClient, stdout }) {
  const { url, serviceRoleKey, email, password } = validateResetInput(env);
  const service = createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const matches = await findExactUsersByEmail(service, email);
  if (matches.length === 0) {
    throw new Error("Auth user not found");
  }
  if (matches.length > 1) {
    throw new Error("Multiple Auth users matched the requested email");
  }

  const [user] = matches;
  await verifyAdminProfile(service, user.id);

  const { error } = await service.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error("Password update failed");
  }

  stdout("Auth user found");
  stdout("Password updated");
  stdout("Email confirmed");
  stdout("Admin profile verified");
  stdout(`Login URL: ${LOGIN_URL}`);
}

async function main() {
  loadEnvLocal();

  try {
    await runResetAdminPassword({
      env: process.env,
      createSupabaseClient: createClient,
      stdout: (line) => console.log(line),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
