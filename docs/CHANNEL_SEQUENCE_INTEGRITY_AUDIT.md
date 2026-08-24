# Channel Sequence Integrity Audit

Audit captured against the linked Supabase project at `2026-08-24T12:36:21.326Z`, before any repair SQL. Run `node scripts/audit-channel-sequences.mjs` to repeat the scan. The uploaded XLSX workbook was not modified.

## Intended Invariant

- `channel_songs.sequence` is a positive, one-based playback position unique inside one channel, never globally unique.
- Active rows are contiguous `1..N` after import, assignment, move, removal, or explicit reorder.
- The same song may belong to multiple channels; one song may appear at most once in the same channel.
- Normal playback sorts by sequence, assignment creation time, then assignment UUID. Playback identity is the assignment UUID, not sequence.
- Listener shuffle never changes database sequence.

The existing implementation did not satisfy one invariant consistently: the table had no positive check or `(channel_id, sequence)` uniqueness; reorder wrote `10,20,30...`; manual assignment wrote `999`; import preview used `max + 1`; and import trusted a client-provided sequence.

## Schema Evidence

- Primary key: `channel_songs.id UUID`.
- Foreign keys: `channel_id -> channels.id ON DELETE CASCADE`; `song_id -> songs.id ON DELETE CASCADE`.
- Existing uniqueness: `(channel_id, song_id)` only. This confirms a song may belong to different channels but not twice to one channel.
- Sequence: `integer NOT NULL`, no default, no positive check, no channel-scoped uniqueness.
- `channel_songs` has `created_at` but no `updated_at`; the requested updated timestamp is therefore reported as unavailable.
- Catalogue order: sequence, `created_at`, song UUID. Admin order: sequence, `created_at`. Queue normalization adds song UUID as a final tie-breaker.

## Reconciliation Summary

| Metric | Before repair |
| --- | ---: |
| Channels | 8 |
| Songs | 94 |
| Channel/song rows | 105 |
| Active channel/song rows | 103 |
| Active rows in reported duplicate groups | 23 |
| All rows in duplicate groups, including inactive history | 25 |
| Non-positive sequence rows | 1 |
| Null sequences | 0 |
| Duplicate `(channel_id, song_id)` rows | 0 |
| Orphan assignments | 0 |
| Active assignments to inactive songs | 0 |
| Wrong-language assignments | 0 |
| Duplicate YouTube IDs represented by different songs | 0 |
| Songs without any channel assignment | 0 |

Active counts and sequence state were: Suprabhata 20 with collisions; Tea Shop 11 with collisions; Ilaiyaraaja 7 with gaps; Prema 14 with collisions; English 51 with an active sequence zero and gaps; Mass Beat, Highway Ratri, and Hindi empty. Relationships and song metadata are valid and must be preserved.

## Duplicate Sequence Rows

State is `assignment active / song active / availability`. Occurrence count includes inactive history where noted.

| Channel | Channel UUID | Assignment UUID | Song UUID | Song title | YouTube ID | Sequence | Created at | Updated at | State | Occurrences |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | ---: |
| Prema & Viraham | 1d1e9bf2-7f4a-4b1e-b375-91f021b81501 | fbe6a32d-ced1-4614-a118-709b51fbeb0e | c64fb3e7-e097-4b69-af09-1f557a8d6a8b | Allantha Doorala | IpXcEukjG1w | 4 | 2026-08-20T06:35:06Z | unavailable | true/true/available | 2 |
| Prema & Viraham | 1d1e9bf2-7f4a-4b1e-b375-91f021b81501 | ca38d14b-b1a3-444d-b4c5-02a7ad0beb68 | 8807e560-a933-4f26-aef7-b99ee7922b19 | Cheppave Chirugali | yBPm4oWiRIM | 4 | 2026-08-20T06:42:29Z | unavailable | true/true/available | 2 |
| Prema & Viraham | 1d1e9bf2-7f4a-4b1e-b375-91f021b81501 | 350b7ed3-b87d-4239-a2d2-ee6f30d16a95 | f188457e-652f-4deb-99d9-faa99d7c18df | Yemi Cheyamanduve | jn664gYJ4Jc | 5 | 2026-08-18T06:20:50Z | unavailable | true/true/available | 2 |
| Prema & Viraham | 1d1e9bf2-7f4a-4b1e-b375-91f021b81501 | 2d0b90d4-7e59-46d2-8ff5-b36c5215ed57 | 6b8d805a-4c2e-4e68-9b3d-033ba074fcce | Niddura Pothunna | kbc_zhP6tzk | 5 | 2026-08-20T06:39:42Z | unavailable | true/true/available | 2 |
| Tea Shop Classics | 2e7a35ee-4a7e-403a-a467-0c505c63fa7c | e42eb12a-c9fc-4552-8f9f-c68883ed3e51 | 1f64281a-5acc-4981-af55-ae324cfe5952 | Chuttu Chutti | lWWZaXQAc8w | 1 | 2026-08-18T04:23:26Z | unavailable | true/true/available | 2 |
| Tea Shop Classics | 2e7a35ee-4a7e-403a-a467-0c505c63fa7c | ed785afe-db2a-476d-a20f-370a4329b449 | 010d8e34-a498-4db5-bd2a-92c6fede0599 | Alanati | EO3JWdSL1mk | 1 | 2026-08-21T04:50:40Z | unavailable | true/true/available | 2 |
| Tea Shop Classics | 2e7a35ee-4a7e-403a-a467-0c505c63fa7c | 26476a93-8e63-4bc4-baaa-bfee359a022d | 2e7b0d88-ac52-46d6-85eb-9ffa6b27bb7d | Ramachakkani Sitha | Yoi2OC1vN90 | 2 | 2026-08-18T04:35:48Z | unavailable | true/true/available | 2 |
| Tea Shop Classics | 2e7a35ee-4a7e-403a-a467-0c505c63fa7c | 42076760-f98f-4149-ae81-438d4debe99f | 46de4160-c5c0-4895-b8e0-12bfda895635 | Anand | vY8caUaAUUM | 2 | 2026-08-20T06:33:15Z | unavailable | true/true/available | 2 |
| Tea Shop Classics | 2e7a35ee-4a7e-403a-a467-0c505c63fa7c | 6ba018b0-4cb6-4ea4-be86-96c42f6db774 | 274a74e9-47f7-4ef6-bafd-242ecd309748 | Manasaa | zV6d16yukFY | 8 | 2026-08-20T06:58:53Z | unavailable | true/true/available | 2 |
| Tea Shop Classics | 2e7a35ee-4a7e-403a-a467-0c505c63fa7c | f3b77a06-97ce-4035-aa99-62f02de096b3 | 217ba7a2-7e14-4232-ab74-da00d22c3900 | Choododdantunna | asynVIsf3FM | 8 | 2026-08-20T10:35:40Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 958eb7d3-7a8a-4198-92e6-979d565af899 | 274a74e9-47f7-4ef6-bafd-242ecd309748 | Manasaa | zV6d16yukFY | 1 | 2026-08-20T07:03:38Z | unavailable | false/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 2b44e8ab-8efb-409c-9c48-69be3abdbf8c | 70e1746b-880d-46c5-9f1e-7031e87a97da | Sri Venkatesha Stotram | f0zCF7rV4bs | 1 | 2026-08-20T10:24:32Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 4f800552-3a1a-4517-863d-943569496ef0 | 8c9dbaf1-be2a-4b2a-b32a-97ac3bb7a777 | Om Namo Venkatesaya | JDVBxF224c0 | 2 | 2026-08-20T10:25:29Z | unavailable | true/true/available | 4 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 30f6bb47-ac96-4336-afd7-849f87211076 | 18a420d1-3460-4f0d-8bd6-23597cdecb50 | Sundari | 6FAtql3ZUF0 | 2 | 2026-08-20T10:39:34Z | unavailable | true/true/available | 4 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 4bd67eb9-1d72-4935-8548-f701e98eb5fc | 067afd52-a07f-4134-b308-9ddaed9ba7a4 | Maate Mantramu | ijmfuRvPmJA | 2 | 2026-08-20T10:40:21Z | unavailable | true/true/available | 4 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 4eb1baed-9cc8-4d0a-a477-16efc07cb7d9 | dd8507a9-33c3-4260-abae-d3a4d70af5fd | Aura Ammakuchella | IZOkXLEA3GU | 2 | 2026-08-20T10:41:15Z | unavailable | true/true/available | 4 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | dcce7fe5-ead6-4e33-a041-60ad7e4122f6 | 083dc986-5c58-45f9-9929-6e6d87a430c1 | Devullu | GFr5NLL1b3A | 6 | 2026-08-20T10:29:59Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 9e07d21e-7a0d-4b99-87b9-82fbc18573fc | 35bfe1f4-021b-4fdc-a56e-4587cecb09e7 | Jaamu Raatiri | Gw_yYjTt8R8 | 6 | 2026-08-20T10:45:13Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | b0d076e6-554b-4a36-9f19-172461a5a010 | 05496936-301a-4775-bd71-d7db0112967e | Krishna Trance | VLoz2REUDjg | 8 | 2026-08-20T10:31:11Z | unavailable | true/true/available | 3 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 319b6e1b-ccb4-4b22-9bd0-f4f16c5aaf8e | 7f58e857-bc07-44db-bfe1-98988dc830ca | Devudu Karunisthadani | wDcWgMY8ri8 | 8 | 2026-08-20T10:46:26Z | unavailable | true/true/available | 3 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 09b1838e-0b80-4f66-8a25-3951965f322f | 6963aa44-ab35-4a6a-b911-6806cd14078b | Dalapathi | 71SylryIWuk | 8 | 2026-08-20T10:47:15Z | unavailable | true/true/available | 3 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | a114266e-d67e-4f37-9d2a-eee384ac387f | de4bca84-06aa-476e-bf93-d0adacfd89a7 | Om Mahaprana Dipam | K-eMFiFSFRg | 9 | 2026-08-20T10:31:53Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | fbbce418-cf80-474c-924a-5d0553991225 | 217ba7a2-7e14-4232-ab74-da00d22c3900 | Choododdantunna | asynVIsf3FM | 9 | 2026-08-20T10:34:54Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | ef9c4d5d-9a8c-4e01-9c12-ed5bfabfcacf | ea3079ce-6b27-44fa-b25e-b78e6f067ae9 | Sri Vigneshwara Stuthi | ZHj2FAnMcX0 | 10 | 2026-08-20T10:32:48Z | unavailable | true/true/available | 2 |
| Suprabhata Melodies | 8caee376-2a9c-4000-9fd7-e0d8c8561913 | 82e582f0-1303-4a0e-8458-510808be31ea | 084299ab-f01a-4215-8351-3c1d773d1b37 | Manassa | UQUbHAIOalc | 10 | 2026-08-20T10:37:46Z | unavailable | true/true/available | 2 |

## Other Integrity Findings

English Hits assignment `5b355826-2fa4-46a4-a6b0-0077ad122382` for song `f21e45c7-afa9-4d93-8893-91383e2b9476`, Coldplay - Hymn For The Weekend (`YykjpeuMNEk`), is active at sequence `0`. It was created at `2026-08-19T12:03:11Z` and is otherwise active/available.

No evidence supports deleting songs: all 94 songs have an assignment; every foreign-key join resolves; YouTube IDs are unique; `(channel_id, song_id)` is unique; and language assignments are valid. The same songs appearing in different channels are legitimate under the current schema.

## Import Reproduction Evidence

- Local YouTube `videos.list` returned HTTP 200 with snippet, duration, public status, and embeddability for an existing catalogue video. Local `YOUTUBE_API_KEY` is configured.
- The review queue contains zero rows, so no playlist-stage failure record exists.
- All 94 songs have assignments, so the current live data does not show a persisted partial song insert.
- Code inspection confirms new-song insert, taxonomy insert, and assignment insert are separate HTTP operations with compensating delete rather than one database transaction.
- Existing YouTube detection returns `duplicate` before attempting assignment, so an existing song cannot be assigned to another channel through this import path.
- The save action accepts the preview's client sequence and collapses every transactional/constraint failure into `ADMIN_YOUTUBE_IMPORT_FAILED`; no stage or Supabase constraint is exposed safely.

Duplicate sequence data did not block imports because no sequence uniqueness constraint existed at audit time. The confirmed import defects are non-atomic writes, stale client allocation, inability to assign an existing song to a different channel, and generic error reduction. Production Netlify logs were not available from this repository, so no unsupported claim is made about a production-only environment failure.

## Playback Reproduction Evidence

Prema's active order is `1,2,3,4,4,5,5,6,7,8,9,10,11,12`. The public mapper resolves ties by assignment `created_at` and song UUID, and the queue advances by array index derived from song UUID; it does not use `sequence + 1`. Therefore duplicate sequence values are integrity defects but do not directly select the first sequence-2 row.

Automatic and manual Next currently duplicate advancement logic. Neither retains assignment UUID or channel UUID in each queue item. Automatic ENDED resets its duplicate-event guard while loading the next song, and live visibility/wall-clock resynchronisation can move an automatically advanced listener back to the scheduled calculated position. These lifecycle paths, rather than a `.find(sequence + 1)` lookup, explain why manual movement can appear temporary and why a prior scheduled position can reappear. The repair must preserve scheduled start calculation while keeping one stable queue-advance path and a durable ended-event key.

## Post-Repair Reconciliation

Migration `20260824130000_channel_sequence_integrity.sql` was applied to the linked project on 2026-08-24. The repeat audit at `2026-08-24T13:41:49.411Z` found 105 assignments and 103 active assignments, exactly matching the pre-repair counts. It found zero duplicate channel sequences, duplicate channel/song pairs, null or non-positive sequences, orphans, inactive-song assignments, language mismatches, duplicate YouTube records, or unassigned songs.

Active queues are now contiguous: Suprabhata `1..20`, Tea Shop `1..11`, Ilaiyaraaja `1..7`, Prema `1..14`, and English `1..51`. Mass Beat, Highway Ratri, and Hindi remain valid empty queues. No songs, assignments, metadata, schedules, analytics, or history were deleted.
