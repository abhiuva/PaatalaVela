import type { QueueItem } from "@/lib/radio/queue";

export const SHUFFLE_STORAGE_KEY = "paatalavela.shuffle.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ShuffleState = {
  channelKey: string;
  catalogueFingerprint: string;
  remainingIds: string[];
  recentIds: string[];
  historyIds: string[];
  cycleLastId: string | null;
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
  return Math.min(3, Math.floor(size / 2));
}

function newCycle(ids: readonly string[], currentId: string | null, recentIds: readonly string[], previousCycleLastId: string | null, random: () => number) {
  const recent = new Set(recentIds);
  const ordered = shuffled(ids, random).sort((left, right) => Number(recent.has(left)) - Number(recent.has(right)));
  if (ordered.length > 1 && (ordered[0] === currentId || ordered[0] === previousCycleLastId)) {
    const swapIndex = ordered.findIndex((id) => id !== currentId && id !== previousCycleLastId);
    if (swapIndex > 0) [ordered[0], ordered[swapIndex]] = [ordered[swapIndex], ordered[0]];
  }
  return ordered;
}

export function createShuffleState(channelKey: string, items: readonly QueueItem[], currentId: string | null, random: () => number = Math.random): ShuffleState {
  const ids = queueIds(items);
  return {
    channelKey,
    catalogueFingerprint: queueFingerprint(items),
    remainingIds: newCycle(ids, currentId, [], null, random),
    recentIds: currentId ? [currentId] : [],
    historyIds: [],
    cycleLastId: null,
  };
}

function reconcileState(state: ShuffleState, channelKey: string, items: readonly QueueItem[], currentId: string | null, random: () => number) {
  const fingerprint = queueFingerprint(items);
  const eligible = new Set(queueIds(items));
  if (state.channelKey !== channelKey) return createShuffleState(channelKey, items, currentId, random);
  if (state.catalogueFingerprint === fingerprint) return state;
  const recentIds = state.recentIds.filter((id) => eligible.has(id));
  return {
    ...state,
    catalogueFingerprint: fingerprint,
    remainingIds: newCycle([...eligible], currentId, recentIds, state.cycleLastId, random),
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
  if (remaining.length === 0) remaining = newCycle(eligibleIds, currentId, nextState.recentIds, nextState.cycleLastId, random);
  let nextIndex = remaining.findIndex((id) => id !== currentId);
  if (nextIndex < 0) {
    remaining = newCycle(eligibleIds, currentId, nextState.recentIds, nextState.cycleLastId, random);
    nextIndex = remaining.findIndex((id) => id !== currentId);
  }
  const nextId = remaining[nextIndex] ?? eligibleIds.find((id) => id !== currentId) ?? eligibleIds[0];
  remaining.splice(Math.max(0, nextIndex), 1);
  const windowSize = recentWindowSize(eligibleIds.length);
  const recentIds = [...nextState.recentIds, ...(currentId ? [currentId] : []), nextId].filter((id, index, values) => values.indexOf(id) === index).slice(-windowSize);
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
    if (parsed?.version === 1 && typeof parsed.enabled === "boolean") return parsed.enabled;
    if (parsed !== null) storage.removeItem(SHUFFLE_STORAGE_KEY);
  } catch {
    storage.removeItem(SHUFFLE_STORAGE_KEY);
  }
  return false;
}

export function writeShufflePreference(storage: StorageLike | null | undefined, enabled: boolean) {
  storage?.setItem(SHUFFLE_STORAGE_KEY, JSON.stringify({ version: 1, enabled }));
}
