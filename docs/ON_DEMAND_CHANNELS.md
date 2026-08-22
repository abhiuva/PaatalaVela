# On-demand Channels

Channels use the database-backed `channel_mode` value `scheduled` or `on_demand`, plus a controlled primary language.

The six existing Telugu channels remain scheduled with their original hours. English Hits remains on demand. Migration `20260822203000_phase1_content_platform.sql` adds Hindi Hits after English Hits:

- UUID: `82f73275-0c49-4fc9-991d-61d9d6e3c492`
- Slug: `hindi-hits`
- Mode: `on_demand`
- Language: `hi`
- Display order: `8`

Selecting an on-demand channel changes only the current browser's manual playback state. It does not enter or modify the scheduled rotation. Hindi Hits is intentionally seeded without songs and uses the standard artwork and empty-state fallbacks.

Songs must be imported through the existing administrator YouTube review workflow. Database triggers reject active Hindi assignments unless the song language is Hindi and its YouTube embed status is `available`. Playlist review never invents missing film, singer, composer, or year values; incomplete items remain pending review.
