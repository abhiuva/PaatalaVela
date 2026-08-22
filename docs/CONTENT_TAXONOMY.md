# Content Taxonomy

Phase 1 adds controlled language, era, mood, and occasion metadata through `20260822203000_phase1_content_platform.sql`.

## Contract

- Every song has one `language_code` and one `era_code`.
- A song may have multiple moods through `song_moods` and multiple occasions through `song_occasions`.
- Language values are `te`, `en`, `hi`, `ta`, and `ml`.
- Era values are `pre-1980`, `1980s`, `1990s`, `2000s`, `2010s`, and `2020s`.
- Mood and occasion options are controlled rows, not administrator-entered free text.
- `song_story` is optional and limited to 320 characters. `context` is optional and limited to 240 characters.

The primary admin form requires title, film, year, duration, singers, composer, YouTube source, language, and era. Story, context, moods, and occasions are optional. Legacy links, lyricist, translated title, and editorial notes remain under advanced fields and are not removed.

## Backfill

The migration assigns English to songs already linked to English Hits and Telugu to other existing songs. Era is derived deterministically from `release_year`. Existing Telugu channel assignments seed mood and occasion candidates using explicit channel mappings. English songs receive no subjective mood or occasion automatically.

After migration, run `npm run catalogue:audit`. Review subjective tags and questionable release metadata in Admin before treating the backfill as editorially approved.

## Rollback

Take a database backup first. Reverse in this order: drop the song/channel enforcement triggers and functions; drop service-only catalogue RPCs and the audit table; remove the Hindi channel only if it has no dependent records; drop song tag joins and controlled tables; then drop the new song/channel columns and analytics event constraint changes. Do not remove the Hindi channel or taxonomy rows after editors have attached production data without first preserving those relationships.
