#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./bootstrap-admin.mjs";

loadEnvLocal();
const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3001";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Admin browser verification requires server Supabase configuration.");

const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const nonce = randomBytes(12).toString("hex");
const email = `verification-${nonce}@example.invalid`;
const password = `Verify-${randomBytes(18).toString("base64url")}`;
let userId = null;
let browser;

try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Temporary Verification" } });
  if (created.error || !created.data.user) throw new Error("Unable to create temporary verification user.");
  userId = created.data.user.id;
  const profile = await service.from("admin_profiles").insert({ id: userId, display_name: "Temporary Verification", role: "admin", active: true });
  if (profile.error) throw new Error("Unable to create temporary verification profile.");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.locator("#admin-password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseUrl}/admin`);

  const controls = {
    manual: await page.getByRole("link", { name: "Add manually" }).isVisible(),
    video: await page.getByRole("heading", { name: "Import YouTube video" }).isVisible(),
    playlist: await page.getByRole("heading", { name: "Import YouTube playlist" }).isVisible(),
    reviewQueue: await page.getByRole("heading", { name: "YouTube Imports" }).isVisible(),
    configurationEnabled: await page.getByText("Configuration status: YouTube metadata import enabled", { exact: true }).isVisible(),
  };
  const sequenceWarningVisible = await page.getByText("Catalogue sequence repair required", { exact: true }).isVisible().catch(() => false);
  await page.getByLabel("YouTube URL or video ID").fill("-QTNFALG3U0");
  await page.getByRole("button", { name: "Fetch details" }).click();
  await page.getByRole("heading", { name: "Review video import" }).waitFor();
  const duplicatePreview = await page.getByText("Duplicate found. Saving is disabled.", { exact: true }).isVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(JSON.stringify({ route: page.url(), controls, sequenceWarningVisible, metadataPreview: true, duplicatePreview, overflow, consoleErrors }, null, 2));
} finally {
  await browser?.close();
  if (userId) {
    await service.from("admin_profiles").delete().eq("id", userId);
    await service.auth.admin.deleteUser(userId);
  }
}
