import type { QueueItem } from "@/lib/radio/queue";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/config/brand";
import type { StorageLike } from "@/lib/storage/migrate";

export const SHUFFLE_STORAGE_KEY = STORAGE_KEYS.shuffle;

export type ShuffleState = {
  channelKey: string;
  catalogueFingerprint: string;
  remainingIds: string[];
  recentIds: string[];
  historyIds: string[];
  cycleLastId: string | null;
  cycleNumber: number;
};

export function queueFingerprint(items: readonly QueueItem[]) {
  return items.map((item) => `${item.assignmentId}:${item.sequence}:${item.embedStatus ?? "available"}`).join("|");
}

function queueIds(items: readonly QueueItem[]) {
  return items.map((item) => item.assignmentId);
}

function shuffled(ids: readonly string[], random: () => number) {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function recentWindowSize(size: number) {
  if (size < 3) return 0;
  return Math.min(5, size - 1);
}

function uniqueRecent(ids: readonly string[], limit: number) {
  const result: string[] = [];
  for (let index = ids.length - 1; index >= 0 && result.length < limit; index -= 1) {
    if (!result.includes(ids[index])) result.unshift(ids[index]);
  }
  return result;
}

function avoidImmediateCandidates(ordered: string[], forbiddenIds: readonly (string | null | undefined)[]) {
  if (ordered.length < 2) return ordered;
  const forbidden = new Set(forbiddenIds.filter((id): id is string => Boolean(id)));
  if (!forbidden.has(ordered[0])) return ordered;
  const swapIndex = ordered.findIndex((id, index) => index > 0 && !forbidden.has(id));
  if (swapIndex > 0) [ordered[0], ordered[swapIndex]] = [ordered[swapIndex], ordered[0]];
  return ordered;
}

function ordinaryNextId(items: readonly QueueItem[], currentId: string | null) {
  if (items.length < 2 || !currentId) return null;
  const index = items.findIndex((item) => item.assignmentId === currentId);
  return items[(index >= 0 ? index + 1 : 0) % items.length]?.assignmentId ?? null;
}

export function buildFirstShuffleCycle(items: readonly QueueItem[], currentId: string | null, recentIds: readonly string[], random: () => number = Math.random) {
  const ids = queueIds(items);
  const candidates = ids.filter((id) => id !== currentId);
  const tailSize = candidates.length > 5 ? 5 : candidates.length;
  const tail = shuffled(candidates.slice(-tailSize), random);
  const remainder = shuffled(candidates.slice(0, candidates.length - tailSize), random);
  const ordered = [...tail, ...remainder];
  return avoidImmediateCandidates(ordered, [currentId, recentIds.at(-1), ordinaryNextId(items, currentId)]);
}

export function buildSubsequentShuffleCycle(ids: readonly string[], currentId: string | null, recentIds: readonly string[], previousCycleLastId: string | null, random: () => number = Math.random) {
  const recent = new Set(recentIds);
  const ordered = shuffled(ids, random).sort((left, right) => Number(recent.has(left)) - Number(recent.has(right)));
  return avoidImmediateCandidates(ordered, [currentId, previousCycleLastId, recentIds.at(-1)]);
}

export function createShuffleState(
  channelKey: string,
  items: readonly QueueItem[],
  currentId: string | null,
  random: () => number = Math.random,
  recentHistory: readonly string[] = [],
): ShuffleState {
  const recentIds = uniqueRecent([...recentHistory, ...(currentId ? [currentId] : [])], recentWindowSize(items.length));
  return {
    channelKey,
    catalogueFingerprint: queueFingerprint(items),
    remainingIds: buildFirstShuffleCycle(items, currentId, recentIds, random),
    recentIds,
    historyIds: [],
    cycleLastId: null,
    cycleNumber: 1,
  };
}

function reconcileState(state: ShuffleState, channelKey: string, items: readonly QueueItem[], currentId: string | null, random: () => number) {
  const fingerprint = queueFingerprint(items);
  const eligibleIds = queueIds(items);
  const eligible = new Set(eligibleIds);
  if (state.channelKey !== channelKey) return createShuffleState(channelKey, items, currentId, random);
  if (state.catalogueFingerprint === fingerprint) return state;
  const recentIds = state.recentIds.filter((id) => eligible.has(id));
  const remainingIds = state.remainingIds.filter((id) => eligible.has(id));
  const known = new Set([...remainingIds, ...recentIds, ...state.historyIds, ...(currentId ? [currentId] : [])]);
  const addedIds = eligibleIds.filter((id) => !known.has(id));
  return {
    ...state,
    catalogueFingerprint: fingerprint,
    remainingIds: [...remainingIds, ...shuffled(addedIds, random)],
    recentIds,
    historyIds: state.historyIds.filter((id) => eligible.has(id)),
  };
}

export function nextShuffledSong(state: ShuffleState, channelKey: string, items: readonly QueueItem[], currentId: string | null, random: () => number = Math.random) {
  const eligibleIds = queueIds(items);
  if (eligibleIds.length === 0) return { state: createShuffleState(channelKey, items, null, random), nextId: null };
  if (eligibleIds.length === 1) return { state: createShuffleState(channelKey, items, currentId, random), nextId: eligibleIds[0] };

  let nextState = reconcileState(state, channelKey, items, currentId, random);
  let remaining = nextState.remainingIds.filter((id) => eligibleIds.includes(id));
  if (remaining.length === 0) {
    remaining = buildSubsequentShuffleCycle(eligibleIds, currentId, nextState.recentIds, nextState.cycleLastId, random);
    nextState = { ...nextState, cycleNumber: nextState.cycleNumber + 1 };
  }
  let nextIndex = remaining.findIndex((id) => id !== currentId);
  if (nextIndex < 0) {
    remaining = buildSubsequentShuffleCycle(eligibleIds, currentId, nextState.recentIds, nextState.cycleLastId, random);
    nextIndex = remaining.findIndex((id) => id !== currentId);
  }
  const nextId = remaining[nextIndex] ?? eligibleIds.find((id) => id !== currentId) ?? eligibleIds[0];
  remaining.splice(Math.max(0, nextIndex), 1);
  const windowSize = recentWindowSize(eligibleIds.length);
  const recentIds = uniqueRecent([...nextState.recentIds, ...(currentId ? [currentId] : []), nextId], windowSize);
  nextState = {
    ...nextState,
    remainingIds: remaining,
    recentIds,
    historyIds: currentId ? [...nextState.historyIds, currentId].slice(-eligibleIds.length * 2) : nextState.historyIds,
    cycleLastId: remaining.length === 0 ? nextId : nextState.cycleLastId,
  };
  return { state: nextState, nextId };
}

export function previousShuffledSong(state: ShuffleState, items: readonly QueueItem[], currentId: string | null) {
  const eligible = new Set(queueIds(items));
  const history = [...state.historyIds];
  let previousId: string | null = null;
  while (history.length && !previousId) {
    const candidate = history.pop() ?? null;
    if (candidate && candidate !== currentId && eligible.has(candidate)) previousId = candidate;
  }
  return { state: { ...state, historyIds: history }, previousId };
}

export function readShufflePreference(storage: StorageLike | null | undefined) {
  if (!storage) return false;
  try {
    const parsed = JSON.parse(storage.getItem(SHUFFLE_STORAGE_KEY) ?? "null") as { version?: unknown; enabled?: unknown } | null;
    if (parsed?.version === 2 && typeof parsed.enabled === "boolean") return parsed.enabled;
    for (const legacyKey of LEGACY_STORAGE_KEYS.shuffle) {
      const legacy = storage.getItem(legacyKey);
      if (!legacy) continue;
      const candidate = JSON.parse(legacy) as { version?: unknown; enabled?: unknown };
      if (candidate.version !== 1 || typeof candidate.enabled !== "boolean") continue;
      const migrated = JSON.stringify({ version: 2, enabled: candidate.enabled });
      storage.setItem(SHUFFLE_STORAGE_KEY, migrated);
      if (storage.getItem(SHUFFLE_STORAGE_KEY) !== migrated) return false;
      storage.removeItem(legacyKey);
      return candidate.enabled;
    }
  } catch {
    return false;
  }
  return false;
}

export function writeShufflePreference(storage: StorageLike | null | undefined, enabled: boolean) {
  storage?.setItem(SHUFFLE_STORAGE_KEY, JSON.stringify({ version: 2, enabled }));
}
