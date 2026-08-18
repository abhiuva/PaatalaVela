const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveChannelReference(value: unknown, findActiveIdBySlug: (slug: string) => Promise<string | null>) {
  if (typeof value !== "string") return null;
  if (UUID_PATTERN.test(value)) return value;
  if (!/^[a-z0-9-]{1,80}$/.test(value)) return null;
  return findActiveIdBySlug(value);
}
