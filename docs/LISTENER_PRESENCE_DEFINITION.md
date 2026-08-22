# Listener Presence Definition

## Metrics

**Live listener:** one non-test, non-bot browser identity whose player state is `playing`, whose last heartbeat is no older than 90 seconds, and whose expiry is in the future. Counts are deduplicated by a server-hashed browser identity.

**Tuned in today:** one distinct anonymous analytics session with a non-test `radio_session_started` event during the current calendar date in `Asia/Kolkata`. The service-only `daily_tuned_listener_count` function returns only an aggregate.

## Operation

- Heartbeat interval: 30 seconds.
- Live-session timeout: 90 seconds.
- Count refresh: 15 seconds, with immediate refresh after heartbeat, reconnect, or returning to a visible tab.
- Request timeout: 8 seconds.
- Hidden tabs pause after a 60-second grace period.
- Multiple tabs reuse one browser presence identity, so the database upsert counts them once.
- Channel attribution uses the resolved internal channel UUID. Switching channels updates the same presence row.
- Obvious bots and explicitly marked test traffic are excluded.
- Expired rows are removed by `delete_expired_listener_sessions` after presence operations.

The API returns aggregate live, channel, and daily counts plus an `asOf` timestamp. It never returns presence rows, hashes, or anonymous session identifiers. API errors show “Listener activity unavailable”; they never display a false count.

Social-proof thresholds default to daily `5`, concurrent `25`, and channel concurrent `10`. Configure them with `SOCIAL_PROOF_DAILY_THRESHOLD`, `SOCIAL_PROOF_CONCURRENT_THRESHOLD`, and `SOCIAL_PROOF_CHANNEL_THRESHOLD`.
