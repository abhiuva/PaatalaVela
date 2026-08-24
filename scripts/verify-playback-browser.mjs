#!/usr/bin/env node

import { chromium } from "@playwright/test";

const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3001";
const populatedChannels = ["Suprabhata Melodies", "Tea Shop Classics", "Ilaiyaraaja Era", "Prema & Viraham", "English Hits"];
const emptyChannels = ["Mass Beat Centre", "Highway Ratri", "Hindi Hits"];

async function installYouTubeStub(page) {
  await page.addInitScript(() => {
    class Player {
      constructor(_elementId, options) {
        this.options = options;
        this.videoId = options.videoId ?? "";
        window.__paatalavelaPlayer = this;
        window.__paatalavelaPlayerOptions = options;
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      loadVideoById(videoId) { this.videoId = videoId; }
      cueVideoById(videoId) { this.videoId = videoId; }
      playVideo() { this.options.events.onStateChange({ data: 1, target: this }); }
      pauseVideo() {}
      stopVideo() { this.videoId = ""; }
      seekTo() {}
      getCurrentTime() { return 0; }
      getVideoData() { return { video_id: this.videoId }; }
      setVolume() {}
      destroy() {}
    }
    window.YT = { Player, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 } };
  });
}

async function title(page) {
  return page.locator("#now-playing-heading").innerText();
}

async function selectChannel(page, name) {
  await page.locator('[aria-labelledby="channels-heading"] button').filter({ hasText: name }).click();
}

async function advanceAutomatically(page) {
  const before = await title(page);
  await page.evaluate(() => {
    const player = window.__paatalavelaPlayer;
    window.__paatalavelaPlayerOptions.events.onStateChange({ data: window.YT.PlayerState.ENDED, target: player });
  });
  await page.waitForFunction((previous) => document.querySelector("#now-playing-heading")?.textContent !== previous, before);
  return title(page);
}

async function verifyViewport(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await installYouTubeStub(page);
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const channelCount = await page.locator('[aria-labelledby="channels-heading"] button').count();
  await page.close();
  return { viewport: `${viewport.width}x${viewport.height}`, overflow, channelCount, consoleErrors: errors };
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await installYouTubeStub(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const matrix = [];
  for (const channel of populatedChannels) {
    await selectChannel(page, channel);
    const startingSong = await title(page);
    const automatic = [];
    for (let index = 0; index < 5; index += 1) automatic.push(await advanceAutomatically(page));

    await selectChannel(page, channel);
    const manual = [];
    for (let index = 0; index < 5; index += 1) {
      const before = await title(page);
      await page.getByRole("button", { name: "Next song" }).click();
      await page.waitForFunction((previous) => document.querySelector("#now-playing-heading")?.textContent !== previous, before);
      manual.push(await title(page));
    }

    await selectChannel(page, channel);
    const beforeShuffle = await title(page);
    await page.getByRole("button", { name: "Enable shuffle" }).click();
    await page.getByRole("button", { name: "Next song" }).click();
    const afterShuffle = await title(page);
    matrix.push({ channel, startingSong, automatic, manual, parity: JSON.stringify(automatic) === JSON.stringify(manual), shuffleAdvanced: beforeShuffle !== afterShuffle });
    await page.getByRole("button", { name: "Disable shuffle" }).click();
  }

  for (const channel of emptyChannels) {
    await selectChannel(page, channel);
    matrix.push({ channel, emptyState: await page.getByText("Songs are being added to this channel.", { exact: true }).isVisible() });
  }

  const adminResponse = await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  const adminRoute = page.url();
  const loginVisible = await page.getByRole("heading", { name: "Sign in" }).isVisible();
  const viewports = [await verifyViewport(browser, { width: 390, height: 844 }), await verifyViewport(browser, { width: 1440, height: 1000 })];
  console.log(JSON.stringify({ matrix, admin: { status: adminResponse?.status(), route: adminRoute, loginVisible }, viewports }, null, 2));
} finally {
  await browser.close();
}
