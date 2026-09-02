# CassettePlay Brand Audit

Audit date: 2026-09-01. This audit excludes generated `.next`, dependency `node_modules`, and coverage output. The uploaded backlog workbook was not modified.

## Approved Decision

`CassettePlay` is the final public platform name. DEV-001 is approved and unblocks DEV-002/DEV-042. No logo artwork was supplied, so the existing typography and functional icons remain without a fabricated logo.

## Public-Facing Occurrences To Rename

- Next.js title, description, Open Graph, Twitter, structured website/publisher data, and web manifest.
- Homepage textual identity (`Telugu Music Radio` and the previous Telugu wordmark), WhatsApp share copy, footer, About page, admin login/navigation, feedback success response, and feedback export filename.
- README title/description and current Phase 1 product documentation.
- Browser verification globals and active shuffle documentation where the old name is not required for compatibility.

## Stable Or Historical Identifiers To Preserve

- Production URL `https://paatalavela-cdb29a.netlify.app`, Netlify site identity, GitHub repository, Supabase project ID/schema/table names, UUIDs, environment names, and migration history.
- Uploaded workbook path `Paatala_Vela_Development_Backlog.xlsx` as historical source evidence.
- npm package name `telugu-radio-mvp` and YouTube player DOM ID `telugu-radio-youtube-player`; these are internal and not displayed.
- Legacy local/session storage keys only as migration inputs. They are removed individually after a valid value is written successfully to the corresponding versioned CassettePlay key.

No service worker, IndexedDB database, branded storage bucket, email template, custom domain configuration, or repository-controlled Netlify display name exists.

## Pre-Change Shuffle Reproduction

Captured with a deterministic random source against the live Supabase catalogue before implementation changes.

### Suprabhata Melodies

- Normal first ten: Om Namo Venkatesaya; Sundari; Maate Mantramu; Aura Ammakuchella; Suddha Brahma; Shiva Tandava Stotram; Mallepoola Pallaki; Devullu; Jaamu Raatiri; Hanuman Chalisa.
- Existing generic shuffle first ten: Sundari; Mukundha Mukundha; Om Mahaprana Dipam; Maate Mantramu; Sri Venkatesha Stotram; Devudu Karunisthadani; Hanuman Chalisa; Sri Vigneshwara Stuthi; Jagamantha Kutumbam; Jaamu Raatiri.

### English Hits

- Normal first ten: One Love; You Belong With Me; Somebody's Me; They Don't Care About Us; I Want It That Way; We Don't Talk Anymore; Photograph; As Long As You Love Me; Attention; Closer.
- Existing generic shuffle first ten: Attention; I Think They Call This Love; On The Floor; Passenger; TiK ToK; Sugar; End Of Beginning; Somebody's Me; Until I Found You; The Night We Met.

The current song remained in place and these deterministic samples differed, including English Hits. The confirmed defect is contractual and intermittent: the old first cycle shuffled the full list uniformly, had no approved tail-first construction, did not prohibit the ordinary next item, and exposed no confirmation beyond button state. English Hits has no separate player path; it inherits the same weak guarantees and perception failure.

## Post-Change Public Surfaces

The centralized `BRAND` value now supplies the homepage identity, root/admin metadata, Open Graph, Twitter, manifest, structured data, share copy, footer, About, admin login/navigation, feedback success message, export filename, not-found/global-error views and applicable policy text. README and active Phase 1 records use the approved name. No logo or new branded image was created.

The final active-source scan found no unintended public-facing retired name. Remaining occurrences are intentional:

- `src/config/brand.ts`: legacy Netlify URL and local/session-storage migration inputs.
- `scripts/verify-playback-browser.mjs` and migration tests: returning-visitor compatibility fixtures.
- `docs/SHUFFLE_PLAYBACK.md`: documented legacy preference input.
- `docs/DEVELOPMENT_BACKLOG_AUDIT.md` and `docs/PHASE1_IMPLEMENTATION_REPORT.md`: unchanged uploaded workbook path.
- `package.json` and the YouTube player DOM ID: non-public stable technical identifiers.

## Production Playback Matrix

Verified against `next start` on 2026-09-01 with deterministic randomness. Each populated channel completed a full first shuffle cycle without a repeat. Manual Next and synthetic YouTube Ended produced the same first ten transitions (or the complete six transitions for the seven-song Ilaiyaraaja queue).

| Channel | Songs | Normal order captured | Shuffle order captured | Changed | Tail first | Manual/auto | Full cycle |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Suprabhata Melodies | 20 | Om Namo; Sundari; Maate Mantramu; Aura Ammakuchella; Suddha Brahma; Shiva Tandava; Mallepoola Pallaki; Devullu; Jaamu Raatiri; Hanuman Chalisa | Manassa; Choododdantunna; Mukundha Mukundha; Jagamantha; Sri Vigneshwara; Om Mahaprana; Om Namo; Jaamu Raatiri; Krishna Trance; Sundari | Pass | Pass | Pass | Pass |
| Tea Shop Classics | 15 | Alanati; Ramachakkani Sitha; Anand; Happy Days; Cheppave Chirugali; Niddura Pothunna; Manasaa; Choododdantunna; Chiguraku Chatu; Manassa | Manasa; Manassa; Kannula Baasalu; O Manasa; Zum Zumare; Niddura Pothunna; Alanati; Chiguraku Chatu; Cheppave Chirugali; Ramachakkani Sitha | Pass | Pass | Pass | Pass |
| Ilaiyaraaja Era | 7 | Sundari; Maate Mantramu; Aura Ammakuchella; Jagamantha; Attarintiki; Alanati | Jagamantha; Maate Mantramu; Attarintiki; Alanati; Aura Ammakuchella; Sundari | Pass | Pass | Pass | Pass |
| Prema & Viraham | 14 | Chiru Chiru; Athey Nanne; Allantha Doorala; Cheppave Chirugali; Yemi Cheyamanduve; Niddura Pothunna; Avunanavaa; Yetu Pone; Baby Won't You Tell Me; Samayama | Hangova; Baby Won't You Tell Me; Amma Amma; Infatuation; Samayama; Niddura Pothunna; Chiru Chiru; Cheppave Chirugali; Yemi Cheyamanduve; Athey Nanne | Pass | Pass | Pass | Pass |
| Mass Beat Centre | 14 | Guns and Roses; Aaya Sher; Choopultho; Attarintiki Daredi; Ringa Ringa; Jigelu Rani; Notanki; Swing Zara; Sai Andri; Jorsey | A Vachi B Pai; Sai Andri; Prathi Gaadhalo; Dheera Dheera; Jorsey; Jigelu Rani; Guns and Roses; Attarintiki Daredi; Ringa Ringa; Aaya Sher | Pass | Pass | Pass | Pass |
| Highway Ratri | 16 | Inkem Inkem; Samajavaragamana; Arerey Manasa; Chuttamalle; Adiga Adiga; Pillaa Raa; Undiporaadhey; Oh Sita; Kadalalle; Nuvvunte Naa Jathagaa | Hosanna; Vintunnavaa; Manasa; Ee Hridayam; Manasaa; Pillaa Raa; Inkem Inkem; Kadalalle; Adiga Adiga; Samajavaragamana | Pass | Pass | Pass | Pass |
| English Hits | 52 | One Love; You Belong With Me; Somebody's Me; They Don't Care About Us; I Want It That Way; We Don't Talk Anymore; Photograph; As Long As You Love Me; Attention; Closer | Love The Way You Lie; Wildest Dreams; On The Floor; Addicted; Blank Space; Hips Don't Lie; One Love; The Heart Wants What It Wants; Please Please Please; You Belong With Me | Pass | Pass | Pass | Pass |
| Hindi Hits | 51 | Patakha Guddi; Uff Teri Adaa; Hey Ya; Matargashti; Aye Udi Udi; Maahi Ve; O Meri Laila; Tum Tak; Challa; Aye Khuda | Pehli Nazar Mein; Aahista Aahista; Voh Dekhnay Mein; Woh Pehli Baar; Sang Rahiyo; Phir Se Ud Chala; Patakha Guddi; Nazm Nazm; Mere Bina; Uff Teri Adaa | Pass | Pass | Pass | Pass |

Desktop `1440x1000` and mobile `390x844` had eight channel controls, visible CassettePlay identity, no horizontal overflow and no console errors. Root title, application name, Open Graph, Twitter and manifest all returned `CassettePlay`. `/admin` redirected correctly to branded `/admin/login`. Valid legacy shuffle, volume and consent preferences migrated and the old keys were removed only after the new values were present.
