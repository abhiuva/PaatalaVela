import { describe, expect, it } from "vitest";
import { buildSequenceRepair, duplicateSequenceGroups, repairReconciles, sequenceIssues, type SequenceAssignment } from "@/lib/catalogue/sequence-integrity";

function row(id: string, channelId: string, songId: string, sequence: number | null, createdAt = "2026-01-01T00:00:00Z", active = true): SequenceAssignment {
  return { id, channelId, songId, sequence, createdAt, active };
}

describe("channel sequence integrity", () => {
  it("flags duplicates only within the same channel", () => {
    const rows = [row("a1", "c1", "s1", 1), row("a2", "c1", "s2", 1), row("a3", "c2", "s3", 1)];
    expect(duplicateSequenceGroups(rows)).toEqual([[rows[0], rows[1]]]);
  });

  it("finds null, zero, negative and gapped active sequences", () => {
    const issues = sequenceIssues([row("a1", "c1", "s1", null), row("a2", "c1", "s2", 0), row("a3", "c2", "s3", -1), row("a4", "c2", "s4", 3)]);
    expect(issues.nullRows.map((item) => item.id)).toEqual(["a1"]);
    expect(issues.nonPositiveRows.map((item) => item.id)).toEqual(["a2", "a3"]);
    expect(issues.gapChannelIds).toEqual(["c1", "c2"]);
  });

  it("repairs deterministically using active, sequence, created time, then assignment ID", () => {
    const repair = buildSequenceRepair([
      row("z", "c1", "s3", 2, "2026-01-02T00:00:00Z"),
      row("b", "c1", "s2", 2),
      row("a", "c1", "s1", 2),
      row("inactive", "c1", "s4", 1, "2025-01-01T00:00:00Z", false),
    ]);
    expect(repair.map((item) => item.id)).toEqual(["a", "b", "z", "inactive"]);
    expect(repair.map((item) => item.repairedSequence)).toEqual([1, 2, 3, 4]);
  });

  it("provides non-colliding temporary values for two-stage reindexing", () => {
    const repair = buildSequenceRepair([row("a", "c1", "s1", 2), row("b", "c1", "s2", 1)]);
    expect(repair.map((item) => item.temporarySequence)).toEqual([1_000_001, 1_000_002]);
    expect(new Set(repair.map((item) => item.temporarySequence)).size).toBe(repair.length);
  });

  it("retains a reversible original-to-repaired mapping and every relationship", () => {
    const source = [row("a", "c1", "s1", 8), row("b", "c1", "s2", 8), row("c", "c2", "s1", 1)];
    const repair = buildSequenceRepair(source);
    expect(repairReconciles(source, repair)).toBe(true);
    expect(repair.map(({ id, originalSequence, repairedSequence }) => ({ id, originalSequence, repairedSequence }))).toEqual([
      { id: "a", originalSequence: 8, repairedSequence: 1 },
      { id: "b", originalSequence: 8, repairedSequence: 2 },
      { id: "c", originalSequence: 1, repairedSequence: 1 },
    ]);
    expect(sequenceIssues(repair.map((item) => ({ ...item, sequence: item.repairedSequence }))).duplicateGroups).toHaveLength(0);
  });
});
