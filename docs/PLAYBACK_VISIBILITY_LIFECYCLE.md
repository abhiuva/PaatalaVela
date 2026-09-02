# Playback Visibility Lifecycle

## Confirmed Defect

Before DEV-043, returning a scheduled listener to a visible tab called the full live-sync path whenever the calculated position differed from the last sampled player position by more than five seconds. That incremented `seekRevision`. The YouTube component included `seekRevision` in its media-load key, so the same queue assignment was cued again and sought. Runtime reproduction retained player instance `1`, channel `2e7a35ee-4a7e-403a-a467-0c505c63fa7c`, assignment `db2961b4-c6cc-4f36-ac35-d38f7ef4e47e`, song `97dbbcd2-0a11-4ed4-907a-28d300919ef3`, and video `rNn0UYQqxCg`, but visibility return issued `cueVideoById` and `seekTo`. The catalogue did not refetch and the queue did not rebuild.

No window focus/blur playback handler, focus-based SWR/React Query refresh, service worker, iframe key change, or presence-triggered player initialization was found. Presence and listener-count hooks have their own visibility/network handlers and do not own playback.

## Lifecycle Contract

- The IFrame API player is created once per genuine `YouTubePlayer` mount and held in a ref. React rerenders, `visibilitychange`, `pageshow`, and supported `resume` events do not create it.
- A media request is identified by stable channel-assignment ID plus YouTube video ID. A changed seek revision for that same request may seek, but cannot cue or load it again.
- A visible event is ignored while hidden and duplicate resume checks are suppressed for 750 ms.
- If YouTube reports `PLAYING`, visibility return performs no player command.
- If an interacted listener is expected to be playing but YouTube reports a suspended state, CassettePlay makes one `playVideo` recovery attempt against the already loaded entry. A missing `PLAYING` confirmation after three seconds changes the existing control to `Tap to resume`.
- Player-ready and player-state callbacks read current handlers from a ref. Duplicate ready signals do not reset the radio state, and genuine unmount destroys the player once.

## Scheduled Recovery

Scheduled playback is reconciled against the current `Asia/Kolkata` schedule and verified live queue. Drift of five seconds or less is ignored. Material drift on the same assignment issues a seek only; it does not reload media. If elapsed time legitimately selects another assignment or scheduled channel, the existing live-sync path loads that authoritative assignment once at its calculated offset. The one-second component seek tolerance prevents rounding-level repeated seeks.

## On-Demand Recovery

English Hits, Hindi Hits, and other manual channels keep their selected assignment, queue index, position, and shuffle state. Visibility does not rebuild their queue or advance a track. If background playback continued, no command is issued. If the browser suspended media, one resume attempt uses the same player and track; an autoplay-policy refusal shows `Tap to resume` without resetting position.

## Presence And Analytics

Presence uses the existing browser session and independently pauses its heartbeat after a prolonged hidden interval. Duplicate visibility notifications are ignored. Listener-count online/visibility refresh does not mutate radio state. `song_started` is deduplicated by channel and assignment, so a seek or resume of the same entry does not emit a second start. Visibility alone does not emit channel selection, impression, or a new listener session. Genuine scheduled reassignment continues to use the normal playback analytics contract.

## Browser Verification

Run against an active local server:

```bash
npm run verify:playback-visibility
```

The verifier uses isolated Chromium contexts and a policy-compatible instrumented IFrame API stub. It records player/iframe count, assignment/video identity, state, position, commands, shuffle state, and duplicate analytics. The default hidden interval is 30 seconds and can be changed with `VISIBILITY_WAIT_MS`.

On 2026-09-02, 30-second and 65-second runs covering the active scheduled channel, English Hits, Hindi Hits mobile, and shuffled English Hits all retained one player and iframe, the same assignment/video/title, advancing position, no load/cue/seek/play command on ordinary return, and no duplicate start/selection analytics. Permitted and blocked suspension recovery, rapid duplicate visibility, focus/blur, and offline-to-online cases also passed. Local Playwright WebKit was unavailable; Safari desktop and physical Safari/iPhone remain manual checks.

Browsers and operating systems may suspend or block background media. CassettePlay cannot override those policies; its responsibility is preserving identity and position, reconciling scheduled time correctly, and presenting a user gesture when automatic recovery is denied.
