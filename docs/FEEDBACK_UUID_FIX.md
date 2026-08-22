# Feedback Channel UUID Contract

`channelId` means `public.channels.id`, never a slug, display name, YouTube identifier, fallback identifier, or empty string.

The listener sends `currentChannel.id` when it is a valid database UUID. General feedback sends `null`. The API accepts a valid UUID or null/omitted input, rejects malformed values with `FEEDBACK_CHANNELID_INVALID`, and rejects structurally valid unknown IDs with `FEEDBACK_CHANNEL_NOT_FOUND`. It never substitutes another channel.

`feedback_submissions.channel_id` is nullable and references `channels(id)`. Inserts run through the controlled server endpoint; the service-role key remains server-only. Public direct table inserts and reads have no RLS policy. Regression coverage is in `src/app/api/feedback/route.test.ts` and `src/lib/feedback/feedback.test.ts`.
