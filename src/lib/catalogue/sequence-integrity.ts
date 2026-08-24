export type SequenceAssignment = {
  id: string;
  channelId: string;
  songId: string;
  sequence: number | null;
  active: boolean;
  createdAt: string;
};

export type SequenceRepairRow = SequenceAssignment & {
  originalSequence: number | null;
  repairedSequence: number;
  temporarySequence: number;
};

export function duplicateSequenceGroups(rows: readonly SequenceAssignment[]) {
  const groups = new Map<string, SequenceAssignment[]>();
  for (const row of rows) {
    if (row.sequence === null) continue;
    const key = `${row.channelId}:${row.sequence}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function sequenceIssues(rows: readonly SequenceAssignment[]) {
  const byChannel = new Map<string, SequenceAssignment[]>();
  for (const row of rows) byChannel.set(row.channelId, [...(byChannel.get(row.channelId) ?? []), row]);
  return {
    duplicateGroups: duplicateSequenceGroups(rows),
    nullRows: rows.filter((row) => row.sequence === null),
    nonPositiveRows: rows.filter((row) => row.sequence !== null && row.sequence <= 0),
    gapChannelIds: [...byChannel.entries()]
      .filter(([, channelRows]) => {
        const actual = channelRows.filter((row) => row.active).map((row) => row.sequence).sort((a, b) => Number(a) - Number(b));
        return actual.some((sequence, index) => sequence !== index + 1);
      })
      .map(([channelId]) => channelId),
  };
}

export function buildSequenceRepair(rows: readonly SequenceAssignment[], temporaryBase = 1_000_000): SequenceRepairRow[] {
  const channels = new Map<string, SequenceAssignment[]>();
  for (const row of rows) channels.set(row.channelId, [...(channels.get(row.channelId) ?? []), row]);
  return [...channels.values()].flatMap((channelRows) =>
    [...channelRows]
      .sort((left, right) =>
        Number(right.active) - Number(left.active)
        || Number(left.sequence ?? Number.MAX_SAFE_INTEGER) - Number(right.sequence ?? Number.MAX_SAFE_INTEGER)
        || left.createdAt.localeCompare(right.createdAt)
        || left.id.localeCompare(right.id),
      )
      .map((row, index) => ({ ...row, originalSequence: row.sequence, repairedSequence: index + 1, temporarySequence: temporaryBase + index + 1 })),
  );
}

export function repairReconciles(source: readonly SequenceAssignment[], repair: readonly SequenceRepairRow[]) {
  const sourceRelationships = source.map((row) => `${row.id}:${row.channelId}:${row.songId}`).sort();
  const repairRelationships = repair.map((row) => `${row.id}:${row.channelId}:${row.songId}`).sort();
  return source.length === repair.length && JSON.stringify(sourceRelationships) === JSON.stringify(repairRelationships);
}
