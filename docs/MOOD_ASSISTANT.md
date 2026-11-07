# Mood Assistant

Mood Assistant turns a listener's short natural-language request into a session-scoped playlist drawn only from the verified Supabase catalogue. It reuses the radio's single visible YouTube IFrame player and never downloads, analyses, or stores YouTube media.

## Request Flow

1. The client posts the listener message, structured language/count or duration selections, up to four prior conversation turns, and current queue IDs to `POST /api/mood-assistant`.
2. A server-only `MoodInterpreter` converts the request into a strict Zod-validated intent. The configured HTTP provider receives no catalogue rows. A deterministic rules interpreter takes over after a timeout, provider error, or invalid response.
3. A service-role-only Supabase RPC returns eligible catalogue candidates. It limits results to active songs with an active channel assignment, `embed_status = available`, a valid 11-character YouTube ID, and a positive duration when duration was requested.
4. The server applies hard constraints and deterministic weighted ranking, removes duplicates, and returns safe match reasons. It never invents a song or exposes confidence or ranking scores.
5. Playback begins only when the listener selects Play. The generated queue enters `assistant` mode inside the existing player state machine.

The route limits requests to 500 characters and ten requests per five-minute client window. Provider interpretation times out after approximately four seconds. Response timings cover interpretation, catalogue retrieval, ranking, and total request processing without recording listener text.

## Ranking

Ranking weights are mood 30%, occasion 20%, language and region 15%, energy and valence 10%, era/artist/composer constraints 10%, diversity 10%, and editorial quality 5%. Language, era, singer, composer, region, exclusions, availability, and catalogue membership are hard constraints when requested.

Fixed-count requests return at most the requested number of songs. Duration requests stop near the requested duration and may exceed it only by the final selected track, bounded to eight minutes. Greedy selection penalizes repeated films, composers, and singers.

## Playback

Assistant playlists are held in browser session state and are not written to a listener's YouTube account. Next, Previous, ended-video advancement, and player-error skipping use the existing queue and visible iframe. Refinement retains the current song and excludes completed songs. `Return to Live Radio` clears the assistant queue and recalculates scheduled playback using India time.

Scheduled, manual, shuffle, and on-demand channel behavior remain unchanged. Shuffle is unavailable while the assistant owns the queue.

## Provider Configuration

All variables are optional. Without them, the deterministic parser is used and the UI identifies the fallback mode.

```text
MOOD_AI_API_URL=
MOOD_AI_API_KEY=
MOOD_AI_MODEL=
```

These variables are server-only. Do not prefix them with `NEXT_PUBLIC_`. The provider must expose an OpenAI-compatible chat-completions endpoint with JSON-schema response support. Supabase server credentials are also required for verified candidate retrieval.

## Classification Review

The migration adds controlled energy, valence, and region tables plus song-level classification provenance. `editorial` and `admin-approved` classifications can be used as approved catalogue intelligence. `AI-suggested` classifications must remain pending or rejected and cannot become approved without an administrator or editor review.

Suggestions are stored separately in `song_classification_suggestions`. RLS permits active administrators and editors to review them; no public policy exposes suggestions. Mood Assistant itself does not write classifications.

## Privacy And Analytics

Raw listener messages and personal situations are not persisted. Generation records contain only controlled facets, requested counts/durations, provider mode, result count, status, and timings. Artist names, composer names, exclusions, provider confidence, tokens, and raw model output are excluded.

Analytics events are consent-aware and contain only bounded operational properties. They never contain listener text, song titles, YouTube URLs, singer names, or personal details.

## Database Migration

Review and apply the forward-only migration outside production first:

```bash
npx supabase migration list
npx supabase db push
```

Migration: `supabase/migrations/20261012120000_mood_assistant.sql`

Do not apply it directly to production without a backup and staging verification. The API returns a safe unavailable response until the RPC and supporting taxonomy exist in the target database.

## Manual QA

1. Open Mood Assistant on desktop and mobile; verify there is no horizontal overflow.
2. Submit requests covering Telugu, Hindi, English, duration, count, era, artist, composer, region, energy, and negative constraints.
3. Confirm provider failure shows fallback state and still returns eligible catalogue songs.
4. Confirm each preview song exists in Supabase and is active and available.
5. Select Play and verify the existing visible YouTube iframe starts only from that click.
6. Exercise Next, Previous, refinement, player-error skip, and Return to Live Radio.
7. Reject optional analytics and verify playback still works without analytics calls.
8. Confirm no raw request appears in analytics payloads or `mood_assistant_generations`.
