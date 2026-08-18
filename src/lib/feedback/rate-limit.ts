export type RateLimitBucket = { count: number; resetAt: number };

export function consumeRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  now = Date.now(),
  limit = 5,
  windowMs = 10 * 60_000,
) {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}
