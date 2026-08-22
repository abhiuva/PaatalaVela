# Catalogue Data-quality Report

Audit run: 2026-08-22. Command: `npm run catalogue:audit` against the configured Supabase project.

| Check | Result |
| --- | --- |
| Songs inspected | 94 |
| Invalid YouTube ID formats | 0 |
| Duplicate YouTube IDs | 0 |
| Possible duplicate title and film pairs | 0 |
| Missing required catalogue metadata | 0 |
| Missing duration | 0 |
| Missing artwork | 0 |
| Non-available embed status | 0 |
| Taxonomy migration applied | Yes |
| Primary language coverage | 94/94 |
| Era coverage | 94/94 |
| Mood coverage | 43/94 |
| Occasion coverage | 43/94 |
| Language distribution | 43 Telugu, 51 English, 0 Hindi |
| Active assignment language mismatches | 0 |
| Hindi assignments | 0; channel intentionally empty |

No song was deleted or deactivated. Migration `20260822203000_phase1_content_platform.sql` applied successfully. All songs received deterministic primary language and era values. The 43 Telugu songs received channel-derived mood and occasion candidates. The 51 English songs intentionally remain without subjective mood and occasion tags and are listed by ID/title when `npm run catalogue:audit` runs; assigning those values requires administrator review. Hindi Hits remains empty.

Existing release years and film values should receive administrator review because some may reflect YouTube publication metadata rather than original release metadata.
