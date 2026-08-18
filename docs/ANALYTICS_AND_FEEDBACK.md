# Analytics and pilot feedback

## Classification and consent

Listening, playback, channel, sharing and sponsor events are optional behavioural analytics. The client provider is a no-op until the visitor explicitly enables analytics. Rejecting or not choosing analytics leaves the radio fully operational and prevents these events from being sent.

Feedback submissions are essential pilot operations, not behavioural analytics. A submission occurs only after the visitor presses **Send feedback**. It contains the chosen rating/comment/category plus channel, song, page, anonymous session and deployment context. It does not ask for identity and does not store a full IP address.

## Storage and access

`POST /api/feedback` validates and rate-limits public feedback, hashes its one-time duplicate token, and inserts through the server-only Supabase service client. RLS provides active administrators with read/update access and gives public roles no feedback read, update or delete policy.

Apply the forward-only schema before enabling feedback in an environment:

```bash
npx supabase db push
```

Do not run `db reset` against a populated environment.

## Sentiment provider

Sentiment is optional and provider-independent. Configure both server-only values:

```dotenv
SENTIMENT_API_URL=https://your-provider.example/analyse
SENTIMENT_API_KEY=server-only-secret
```

The endpoint must return `label`, `score`, `confidence`, `summary`, and `themes`. Output is schema-validated. The provider must support Telugu script, English, Telugu transliteration and mixed-language comments. Without a provider, feedback still saves and comments remain `pending`; no analysis is fabricated.

## Aggregation and health

Listening events are ingested by `POST /api/analytics/events`. Channel and sponsor daily metrics are updated inline by that endpoint, so aggregation is currently **on demand**, not scheduled. Netlify does not need a cron job for the current model. If ingestion is later separated from aggregation, create a scheduled Supabase function or Netlify scheduled function and update the Admin Analytics health definition.

The admin test action inserts `schedule_viewed` with `is_test=true`. Health confirms it while production event counts and daily metrics exclude it. Feedback records are also excluded from behavioural event counts.

## Active listener presence

Live presence is strictly necessary, short-lived operational state and does not depend on optional analytics consent. It starts only after the listener activates playback. The browser keeps one random identifier in local storage so duplicate tabs refresh the same row; the server stores only an HMAC hash.

A playing heartbeat is sent approximately every 30 seconds. The public count includes only non-test playing rows seen within 90 seconds whose expiry remains in the future. Pause, exit and prolonged tab inactivity stop heartbeats or send a final state update. Public callers receive aggregate totals only, and expired rows are removed opportunistically.
