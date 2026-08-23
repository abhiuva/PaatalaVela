# Cache And Revalidation

## Audit Result

The public catalogue is read by the client from `/api/catalogue`; channel selection additionally reads `/api/catalogue/channels/{channelUuid}`. Both routes are dynamic and return `Cache-Control`, `CDN-Cache-Control`, and `Netlify-CDN-Cache-Control` values of `no-store`. Client requests also use `cache: "no-store"`.

No application service worker or browser Cache API registration is present. Static Next.js assets retain their normal immutable caching; caching is not disabled globally. The stale-player failure was primarily state/callback ownership, not an immutable API response.

## Keys And Request Ownership

- Targeted channel requests are keyed by the internal Supabase channel UUID and catalogue contract version `v1`.
- Only one targeted request owns the listener state at a time. A new selection aborts its predecessor and increments a request ID.
- A response updates only the matching channel UUID and only when its request ID is still current. It cannot replace another channel's queue.
- Queue fingerprints include song ID, sequence, and availability so shuffle state rebuilds after relevant catalogue changes.
- The persistent player load key is YouTube video ID plus request revision. Null queues stop the existing media.

## Administration

Admin mutations continue to revalidate the listener page and complete catalogue route. Mutations that know an affected channel UUID also revalidate its exact `/api/catalogue/channels/{channelUuid}` path. Because listener catalogue endpoints are no-store, a later channel selection always requests current database state even if platform revalidation is delayed.

## Failure And Retry

Refresh failure preserves the selected channel and current local verified queue, displays `Unable to load channel`, and provides a retry for that UUID. It does not substitute another channel or merge queues. Initial full-catalogue failure retains the existing explicit local-shell diagnostic behavior; local placeholder songs are not playable.

## Rollback

Remove the targeted route and `refreshChannel` call to return to full-catalogue-only loading. Do not remove the no-store headers from the existing public catalogue route unless a new versioned shared-cache policy is introduced and tested.
