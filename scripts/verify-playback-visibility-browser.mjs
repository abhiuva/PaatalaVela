#!/usr/bin/env node

import { chromium, webkit } from "@playwright/test";

const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const backgroundWaitMs = Number(process.env.VISIBILITY_WAIT_MS ?? 30_000);

async function installInstrumentation(page) {
  await page.addInitScript(() => {
    localStorage.setItem("cassetteplay.analytics-consent.v1", "accepted");
    const diagnostics = { calls: [], instances: 0, destroys: 0 };
    class Player {
      constructor(_elementId, options) {
        this.options = options;
        this.videoId = options.videoId ?? "";
        this.state = -1;
        this.position = 0;
        this.startedAt = 0;
        this.instanceId = ++diagnostics.instances;
        const host = document.getElementById(_elementId);
        if (host && host.tagName !== "IFRAME") {
          const iframe = document.createElement("iframe");
          iframe.id = _elementId;
          iframe.title = "Instrumented YouTube radio player";
          host.replaceWith(iframe);
        }
        window.__visibilityPlayer = this;
        window.__visibilityDiagnostics = diagnostics;
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      currentPosition() {
        return this.state === 1 ? this.position + (performance.now() - this.startedAt) / 1000 : this.position;
      }
      record(command, value) { diagnostics.calls.push({ command, value, at: performance.now(), instanceId: this.instanceId }); }
      loadVideoById(value) {
        this.videoId = typeof value === "string" ? value : value.videoId;
        this.position = 0;
        this.startedAt = performance.now();
        this.state = 1;
        this.record("loadVideoById", this.videoId);
        queueMicrotask(() => this.options.events.onStateChange({ data: 1, target: this }));
      }
      cueVideoById(value) {
        this.videoId = typeof value === "string" ? value : value.videoId;
        this.position = 0;
        this.state = 5;
        this.record("cueVideoById", this.videoId);
      }
      playVideo() {
        this.position = this.currentPosition();
        this.startedAt = performance.now();
        this.record("playVideo", this.videoId);
        if (this.blockPlayback) return;
        this.state = 1;
        queueMicrotask(() => this.options.events.onStateChange({ data: 1, target: this }));
      }
      pauseVideo() {
        this.position = this.currentPosition();
        this.state = 2;
        this.record("pauseVideo", this.videoId);
      }
      stopVideo() { this.position = 0; this.state = -1; this.videoId = ""; this.record("stopVideo", null); }
      seekTo(seconds) { this.position = seconds; this.startedAt = performance.now(); this.record("seekTo", seconds); }
      getCurrentTime() { return this.currentPosition(); }
      getPlayerState() { return this.state; }
      getVideoData() { return { video_id: this.videoId }; }
      setVolume(volume) { this.record("setVolume", volume); }
      destroy() { diagnostics.destroys += 1; this.record("destroy", null); }
      simulateSuspension() { this.position = this.currentPosition(); this.state = 2; }
    }
    window.YT = { Player, PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, CUED: 5 } };
  });
}

function scheduledChannel(channels) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  return channels.find((channel) => {
    if (channel.mode !== "scheduled") return false;
    const { startHour, endHour } = channel.schedule;
    return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
  });
}

async function snapshot(page, catalogue, analytics) {
  return page.evaluate(({ catalogueData, analyticsCount }) => {
    const player = window.__visibilityPlayer;
    const diagnostics = window.__visibilityDiagnostics;
    const activeButton = document.querySelector('[aria-labelledby="channels-heading"] button[aria-pressed="true"]');
    const videoId = player?.getVideoData().video_id ?? null;
    const assignment = catalogueData.channels.flatMap((channel) => channel.songs).find((song) => song.youtubeVideoId === videoId)?.assignmentId ?? null;
    return {
      channelText: activeButton?.textContent?.trim() ?? null,
      title: document.querySelector("#now-playing-heading")?.textContent ?? null,
      videoId,
      assignmentId: assignment,
      instanceId: player?.instanceId ?? null,
      instanceCount: diagnostics?.instances ?? 0,
      iframeCount: document.querySelectorAll("iframe#telugu-radio-youtube-player").length,
      playerState: player?.getPlayerState() ?? null,
      position: player?.getCurrentTime() ?? 0,
      commandCount: diagnostics?.calls.length ?? 0,
      destroys: diagnostics?.destroys ?? 0,
      shufflePressed: document.querySelector('button[aria-label="Disable shuffle"]')?.getAttribute("aria-pressed") ?? "false",
      analyticsCount,
    };
  }, { catalogueData: catalogue, analyticsCount: analytics.length });
}

async function setVisibility(page, state) {
  await page.evaluate((nextState) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => nextState });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function prepareCase(browser, catalogue, testCase) {
  const context = await browser.newContext({ viewport: testCase.viewport ?? { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const analytics = [];
  await installInstrumentation(page);
  page.on("request", (request) => {
    if (request.url().includes("/api/analytics/events")) analytics.push(request.postData() ?? "");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  if (testCase.channelName) {
    await page.locator('[aria-labelledby="channels-heading"] button').filter({ hasText: testCase.channelName }).click();
  } else {
    await page.getByRole("button", { name: "Start radio" }).click();
  }
  if (testCase.shuffle) await page.getByRole("button", { name: "Enable shuffle" }).click();
  await page.waitForFunction(() => window.__visibilityPlayer?.getPlayerState() === 1);
  await page.waitForTimeout(1200);
  const before = await snapshot(page, catalogue, analytics);
  return { context, page, analytics, before };
}

async function runContinuedCase(browser, catalogue, testCase) {
  const prepared = await prepareCase(browser, catalogue, testCase);
  const { context, page, analytics, before } = prepared;
  await setVisibility(page, "hidden");
  await page.waitForTimeout(backgroundWaitMs);
  await setVisibility(page, "visible");
  await page.waitForTimeout(1000);
  const after = await snapshot(page, catalogue, analytics);
  const calls = await page.evaluate((start) => window.__visibilityDiagnostics.calls.slice(start), before.commandCount);
  const duplicateAnalytics = analytics.slice(before.analyticsCount).filter((body) => body.includes("song_started") || body.includes("channel_selected"));
  await context.close();
  return {
    case: testCase.label,
    before,
    after,
    transitionCalls: calls,
    duplicateAnalytics: duplicateAnalytics.length,
    pass: before.instanceId === after.instanceId
      && after.instanceCount === 1
      && before.assignmentId === after.assignmentId
      && before.videoId === after.videoId
      && before.title === after.title
      && after.position >= before.position + backgroundWaitMs / 1000 - 2
      && calls.every((call) => !["loadVideoById", "cueVideoById", "seekTo", "playVideo"].includes(call.command))
      && duplicateAnalytics.length === 0
      && (!testCase.shuffle || after.shufflePressed === "true"),
  };
}

async function runSuspensionCase(browser, catalogue, blocked) {
  const english = catalogue.channels.find((channel) => channel.name === "English Hits" && channel.songs.some((song) => song.active && song.embedStatus === "available"));
  if (!english) return { case: blocked ? "Suspended and blocked" : "Suspended and permitted", skipped: "English Hits has no verified song" };
  const prepared = await prepareCase(browser, catalogue, { channelName: english.name });
  const { context, page, analytics, before } = prepared;
  await setVisibility(page, "hidden");
  await page.evaluate((shouldBlock) => {
    window.__visibilityPlayer.simulateSuspension();
    window.__visibilityPlayer.blockPlayback = shouldBlock;
  }, blocked);
  await setVisibility(page, "visible");
  await page.waitForTimeout(blocked ? 3300 : 500);
  const after = await snapshot(page, catalogue, analytics);
  const calls = await page.evaluate((start) => window.__visibilityDiagnostics.calls.slice(start), before.commandCount);
  const resumeVisible = blocked ? await page.getByText("Tap to resume", { exact: true }).first().isVisible() : false;
  await context.close();
  return {
    case: blocked ? "Suspended and automatic resume blocked" : "Suspended and automatic resume permitted",
    before,
    after,
    transitionCalls: calls,
    resumeVisible,
    pass: before.instanceId === after.instanceId
      && before.assignmentId === after.assignmentId
      && calls.filter((call) => call.command === "playVideo").length === 1
      && calls.every((call) => !["loadVideoById", "cueVideoById", "seekTo"].includes(call.command))
      && (blocked ? resumeVisible && after.playerState === 2 : after.playerState === 1),
  };
}

async function runLifecycleNoiseCase(browser, catalogue) {
  const english = catalogue.channels.find((channel) => channel.name === "English Hits" && channel.songs.some((song) => song.active && song.embedStatus === "available"));
  if (!english) return { case: "Focus, network and duplicate events", skipped: "English Hits has no verified song" };
  const prepared = await prepareCase(browser, catalogue, { channelName: english.name });
  const { context, page, analytics, before } = prepared;
  await context.setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1000);
  const after = await snapshot(page, catalogue, analytics);
  const calls = await page.evaluate((start) => window.__visibilityDiagnostics.calls.slice(start), before.commandCount);
  await context.close();
  return {
    case: "Repeated focus, duplicate visibility, offline-to-online",
    before,
    after,
    transitionCalls: calls,
    pass: before.instanceId === after.instanceId
      && before.assignmentId === after.assignmentId
      && calls.every((call) => !["loadVideoById", "cueVideoById", "seekTo", "playVideo"].includes(call.command)),
  };
}

async function checkWebKitAvailability() {
  try {
    const browser = await webkit.launch({ headless: true });
    await browser.close();
    return "available";
  } catch (error) {
    return `unavailable: ${String(error).split("\n")[0]}`;
  }
}

const response = await fetch(`${baseUrl}/api/catalogue`);
if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
const catalogue = await response.json();
const activeScheduled = scheduledChannel(catalogue.channels);
const cases = [
  { label: `Scheduled: ${activeScheduled?.name ?? "unavailable"}`, channelName: null },
  { label: "On demand: English Hits", channelName: "English Hits" },
  { label: "On demand: Hindi Hits", channelName: "Hindi Hits", viewport: { width: 390, height: 844 } },
  { label: "Shuffled: English Hits", channelName: "English Hits", shuffle: true },
].filter((item) => !item.channelName || catalogue.channels.some((channel) => channel.name === item.channelName && channel.songs.some((song) => song.active && song.embedStatus === "available")));

const browser = await chromium.launch({ headless: true });
try {
  const results = await Promise.all(cases.map((testCase) => runContinuedCase(browser, catalogue, testCase)));
  const recovery = [
    await runSuspensionCase(browser, catalogue, false),
    await runSuspensionCase(browser, catalogue, true),
    await runLifecycleNoiseCase(browser, catalogue),
  ];
  const webkitStatus = await checkWebKitAvailability();
  console.log(JSON.stringify({ baseUrl, backgroundWaitMs, browser: "Chromium isolated contexts", webkitStatus, results, recovery }, null, 2));
  if ([...results, ...recovery].some((result) => result.pass === false)) process.exitCode = 1;
} finally {
  await browser.close();
}
