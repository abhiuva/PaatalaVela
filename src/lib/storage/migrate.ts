export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readMigratedStorageValue(
  storage: StorageLike | null | undefined,
  currentKey: string,
  legacyKeys: readonly string[],
  isValid: (value: string) => boolean,
) {
  if (!storage) return null;
  const current = storage.getItem(currentKey);
  if (current !== null && isValid(current)) return current;

  for (const legacyKey of legacyKeys) {
    const legacy = storage.getItem(legacyKey);
    if (legacy === null || !isValid(legacy)) continue;
    try {
      storage.setItem(currentKey, legacy);
      if (storage.getItem(currentKey) !== legacy) return null;
      storage.removeItem(legacyKey);
      return legacy;
    } catch {
      return null;
    }
  }
  return null;
}
