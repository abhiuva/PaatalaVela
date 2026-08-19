# Dummy Song Audit

Audit performed against the linked Supabase project on 2026-08-19 before cleanup.

## Decision Rules

A record is a confirmed cleanup candidate only when it matches the explicit seed evidence: a title containing `Placeholder`, film `Replace With Film`, composer `Replace Composer`, singer `Replace Singer`, `embed_status = unchecked`, and one of the allowlisted seed YouTube IDs. Incomplete metadata alone is not a deletion reason.

All 30 candidates had zero references from `channel_songs`, `listening_events`, `feedback_submissions`, `takedown_requests`, `active_listener_sessions`, or `youtube_import_queue` at audit time.

## Confirmed Candidates

| Song UUID | Title | YouTube ID | Source | Evidence |
| --- | --- | --- | --- | --- |
| `a00c7f20-ff1b-4424-9086-dd506f296a4d` | Suprabhata Placeholder 1 | `dQw4w9WgXcQ` | `public.songs` / seed | Explicit placeholder metadata; unchecked seed record |
| `e820479d-79db-4734-bc4b-0c2ec44fa703` | Suprabhata Placeholder 2 | `M7lc1UVf-VE` | `public.songs` / seed | Explicit placeholder metadata; unchecked seed record |
| `214c47a9-8af9-4902-b4b5-be7a99e6fbb0` | Suprabhata Placeholder 3 | `ScMzIvxBSi4` | `public.songs` / seed | Explicit placeholder metadata; unchecked seed record |
| `318ecd7b-6214-4bec-a1e1-dc49299c49dc` | Suprabhata Placeholder 4 | `ysz5S6PUM-U` | `public.songs` / seed | Explicit placeholder metadata; unchecked seed record |
| `07de7cfe-d7fb-4f64-9f73-bcaf7e7ceb6b` | Suprabhata Placeholder 5 | `aqz-KE-bpKQ` | `public.songs` / seed | Explicit placeholder metadata; unchecked seed record |
| `d1b36663-1ce3-4a87-a1a5-4af1fb270f51` | Tea Shop Placeholder 1 | `tc000000001` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `a649a26b-0b37-4c0a-a984-c98d55710873` | Tea Shop Placeholder 2 | `tc000000002` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `a3f06579-8634-4557-9319-d3bd6677de2d` | Tea Shop Placeholder 3 | `tc000000003` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `a10f2bc3-635d-49b7-ae35-20c4edf62511` | Tea Shop Placeholder 4 | `tc000000004` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `7442fff3-c58c-42a6-b412-5fa0e66457cf` | Tea Shop Placeholder 5 | `tc000000005` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `e0507594-d351-4104-b235-d26ec8518b7b` | Ilaiyaraaja Era Placeholder 1 | `ir000000001` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `81f86ee6-adfc-424e-b853-c73ee51afab1` | Ilaiyaraaja Era Placeholder 2 | `ir000000002` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `ee2aabd1-7f41-4c3e-8cbb-372293c5227a` | Ilaiyaraaja Era Placeholder 3 | `ir000000003` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `72270ed0-71e6-406b-992f-19b56e702dfd` | Ilaiyaraaja Era Placeholder 4 | `ir000000004` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `805d809f-8409-4651-a1ae-8cb08408e0a0` | Ilaiyaraaja Era Placeholder 5 | `ir000000005` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `aea8dfb4-0328-427c-afad-8b2fe2efe60b` | Prema Viraham Placeholder 1 | `pv000000001` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `40446a11-d235-4fab-b970-63412815146e` | Prema Viraham Placeholder 2 | `pv000000002` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `6949d56e-9116-41bf-a365-cab078d2b2bc` | Prema Viraham Placeholder 3 | `pv000000003` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `7de0d6d5-af40-4b4a-9656-67150fda72f8` | Prema Viraham Placeholder 4 | `pv000000004` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `0a156189-3a11-4f89-931d-9a1d9e3522ad` | Prema Viraham Placeholder 5 | `pv000000005` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `314c7ab6-0e22-4078-8c85-f559d2b8954f` | Mass Beat Placeholder 1 | `mb000000001` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `04fa8972-bb74-4e59-b862-15b8c434790c` | Mass Beat Placeholder 2 | `mb000000002` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `48b1ac54-2792-496c-b2ac-67d5b9fdd7e4` | Mass Beat Placeholder 3 | `mb000000003` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `ffb69bfc-53bd-4ac8-9485-cd6c15149a5f` | Mass Beat Placeholder 4 | `mb000000004` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `a4cb62f3-b50d-4ece-a620-4cad45637262` | Mass Beat Placeholder 5 | `mb000000005` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `b502b8e3-11a5-4ed2-931b-cb2625525d2e` | Highway Ratri Placeholder 1 | `hr000000001` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `ff707f63-e71e-444d-8ff4-b4225862c1fd` | Highway Ratri Placeholder 2 | `hr000000002` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `7b1c73ca-b76d-4b5f-96a5-5aade231fff5` | Highway Ratri Placeholder 3 | `hr000000003` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `5517f1e7-1331-43d7-8739-db2d924f8876` | Highway Ratri Placeholder 4 | `hr000000004` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |
| `499b6d32-ce71-4cc1-8123-a05a0880ef8c` | Highway Ratri Placeholder 5 | `hr000000005` | `public.songs` / seed | Fabricated channel-prefixed ID; explicit placeholder metadata |

## Retained Records

Ten existing non-placeholder catalogue records were retained. Each was active, assigned once, returned by the YouTube Data API, public, and embeddable at audit time. No song was classified as dummy merely for incomplete metadata.

## Repeatable Cleanup

Migration `20260819120000_add_english_hits_cleanup_placeholders.sql` selects candidates using both the exact YouTube ID allowlist and explicit placeholder metadata. It removes dependent assignments first. A candidate with historical or operational references is deactivated for review instead of deleted; an unreferenced confirmed candidate is deleted.
