#!/usr/bin/env node

import { chromium } from "@playwright/test";

const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3001";

async function installYouTubeStub(page) {
  await page.addInitScript(() => {
    class Player {
      constructor(_elementId, options) {
        this.options = options;
        this.videoId = options.videoId ?? "";
        window.__cassetteplayPlayer = this;
        window.__cassetteplayPlayerOptions = options;
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      loadVideoById(value) { this.videoId = typeof value === "string" ? value : value.videoId; }
      cueVideoById(value) { this.videoId = typeof value === "string" ? value : value.videoId; }
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

async function currentTitle(page) {
  return page.locator("#now-playing-heading").innerText();
}

async function clickChannel(page, name, firstTitle) {
  await page.locator('[aria-labelledby="channels-heading"] button').filter({ hasText: name }).evaluate((button) => button.click());
  if (firstTitle) {
    try {
      await page.waitForFunction((expected) => document.querySelector("#now-playing-heading")?.textContent === expected, firstTitle, { timeout: 5000 });
    } catch (error) {
      const current = await currentTitle(page);
      const active = await page.locator('[aria-labelledby="channels-heading"] button[aria-pressed="true"] span:nth-of-type(2)').allInnerTexts();
      throw new Error(`Selecting ${name} expected ${firstTitle}, rendered ${current}, active ${active.join(", ")}`, { cause: error });
    }
  } else {
    await page.getByText("Songs are being added to this channel.", { exact: true }).waitFor();
  }
}

async function selectChannel(page, name, firstTitle, alternate) {
  if (alternate && alternate.name !== name) await clickChannel(page, alternate.name, alternate.firstTitle);
  await clickChannel(page, name, firstTitle);
}

async function setShuffle(page, enabled) {
  const button = page.getByRole("button", { name: enabled ? "Enable shuffle" : "Disable shuffle" });
  if (await button.count()) {
    if (enabled) await page.evaluate(() => { Math.random = () => 0.37; });
    await button.click();
  }
}

async function advance(page, automatic, context) {
  const before = await currentTitle(page);
  if (automatic) {
    await page.evaluate(() => {
      const player = window.__cassetteplayPlayer;
      player.getVideoData = () => ({ video_id: null });
      window.__cassetteplayPlayerOptions.events.onStateChange({ data: window.YT.PlayerState.ENDED, target: player });
    });
  } else {
    await page.getByRole("button", { name: "Next song" }).click();
  }
  try {
    await page.waitForFunction((previous) => document.querySelector("#now-playing-heading")?.textContent !== previous, before, { timeout: 5000 });
  } catch (error) {
    const after = await currentTitle(page);
    throw new Error(`${context}: song did not advance from ${before} (current ${after})`, { cause: error });
  }
  return currentTitle(page);
}

async function capture(page, count, automatic, context) {
  const result = [];
  for (let index = 0; index < count; index += 1) result.push(await advance(page, automatic, `${context} step ${index + 1}`));
  return result;
}

async function verifyViewport(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await installYouTubeStub(page);
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const result = {
    viewport: `${viewport.width}x${viewport.height}`,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    channelCount: await page.locator('[aria-labelledby="channels-heading"] button').count(),
    brandVisible: await page.getByRole("heading", { name: "CassettePlay" }).isVisible(),
    consoleErrors: errors,
  };
  await page.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
try {
  const catalogueResponse = await fetch(`${baseUrl}/api/catalogue`);
  if (!catalogueResponse.ok) throw new Error(`Catalogue request failed: ${catalogueResponse.status}`);
  const catalogue = await catalogueResponse.json();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await installYouTubeStub(page);
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const matrix = [];
  const populated = catalogue.channels
    .map((channel) => ({ name: channel.name, firstTitle: channel.songs.find((song) => song.active && song.embedStatus === "available")?.title }))
    .filter((channel) => channel.firstTitle);
  for (const channel of catalogue.channels) {
    process.stderr.write(`Verifying ${channel.name}\n`);
    const eligible = channel.songs.filter((song) => song.active && song.embedStatus === "available");
    const alternate = populated.find((candidate) => candidate.name !== channel.name);
    if (eligible.length < 2) {
      await selectChannel(page, channel.name, eligible[0]?.title, alternate);
      matrix.push({
        channel: channel.name,
        songCount: eligible.length,
        emptyState: eligible.length === 0
          ? await page.getByText("Songs are being added to this channel.", { exact: true }).isVisible()
          : true,
        shuffleDisabled: await page.getByRole("button", { name: "Enable shuffle" }).isDisabled(),
      });
      continue;
    }

    const transitionCount = Math.min(10, eligible.length - 1);
    await selectChannel(page, channel.name, eligible[0].title, alternate);
    await setShuffle(page, false);
    const startTitle = await currentTitle(page);
    const normal = await capture(page, transitionCount, false, `${channel.name} normal`);

    await selectChannel(page, channel.name, eligible[0].title, alternate);
    await setShuffle(page, false);
    const beforeEnable = await currentTitle(page);
    await setShuffle(page, true);
    const currentPreserved = beforeEnable === await currentTitle(page);
    const activationFeedback = await page.getByText("Upcoming songs shuffled", { exact: true }).isVisible();
    const activeLabel = await page.getByRole("button", { name: "Disable shuffle" }).getAttribute("aria-pressed");
    const fullCycle = await capture(page, eligible.length - 1, false, `${channel.name} shuffled manual`);

    await setShuffle(page, false);
    await selectChannel(page, channel.name, eligible[0].title, alternate);
    await setShuffle(page, true);
    const automatic = await capture(page, transitionCount, true, `${channel.name} shuffled automatic`);

    const tailTitles = eligible.filter((song) => song.title !== startTitle).slice(-5).map((song) => song.title);
    matrix.push({
      channel: channel.name,
      mode: channel.mode,
      songCount: eligible.length,
      normal,
      shuffle: fullCycle.slice(0, transitionCount),
      automatic,
      orderChanged: JSON.stringify(normal) !== JSON.stringify(fullCycle.slice(0, transitionCount)),
      manualAutomaticParity: JSON.stringify(fullCycle.slice(0, transitionCount)) === JSON.stringify(automatic),
      tailFirst: fullCycle.slice(0, tailTitles.length).every((title) => tailTitles.includes(title)) && new Set(fullCycle.slice(0, tailTitles.length)).size === tailTitles.length,
      fullCycle: new Set([startTitle, ...fullCycle]).size === eligible.length,
      noPrematureRepeat: new Set(fullCycle).size === fullCycle.length,
      currentPreserved,
      activationFeedback,
      ariaPressed: activeLabel,
    });
    await setShuffle(page, false);
  }

  const metadata = await page.evaluate(() => ({
    title: document.title,
    applicationName: document.querySelector('meta[name="application-name"]')?.getAttribute("content"),
    openGraphTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    openGraphSiteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
  }));
  const manifest = await (await page.request.get(`${baseUrl}/manifest.webmanifest`)).json();

  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  const admin = {
    route: page.url(),
    title: await page.title(),
    brandVisible: await page.getByText("CassettePlay Admin", { exact: true }).first().isVisible(),
    loginVisible: await page.getByRole("heading", { name: "Sign in" }).isVisible(),
  };

  const returning = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await returning.addInitScript(() => {
    localStorage.setItem("paatalavela.shuffle.v1", JSON.stringify({ version: 1, enabled: true }));
    localStorage.setItem("telugu-radio.volume", "42");
    localStorage.setItem("telugu-radio.analytics-consent", "rejected");
  });
  await installYouTubeStub(returning);
  await returning.goto(baseUrl, { waitUntil: "networkidle" });
  await returning.waitForFunction(() => localStorage.getItem("cassetteplay.volume.v1") === "42");
  const legacyMigration = await returning.evaluate(() => ({
    shuffle: localStorage.getItem("cassetteplay.shuffle.v2"),
    volume: localStorage.getItem("cassetteplay.volume.v1"),
    consent: localStorage.getItem("cassetteplay.analytics-consent.v1"),
    legacyShuffleRemoved: localStorage.getItem("paatalavela.shuffle.v1") === null,
    legacyVolumeRemoved: localStorage.getItem("telugu-radio.volume") === null,
    legacyConsentRemoved: localStorage.getItem("telugu-radio.analytics-consent") === null,
  }));
  await returning.close();

  const viewports = [await verifyViewport(browser, { width: 390, height: 844 }), await verifyViewport(browser, { width: 1440, height: 1000 })];
  console.log(JSON.stringify({ matrix, metadata, manifest, admin, legacyMigration, viewports, consoleErrors }, null, 2));
} finally {
  await browser.close();
}
