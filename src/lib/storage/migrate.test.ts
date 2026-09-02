import { describe, expect, it } from "vitest";
import { readMigratedStorageValue } from "@/lib/storage/migrate";

describe("CassettePlay preference migration", () => {
  it("moves a valid legacy value only after the new write succeeds", () => {
    const values = new Map<string, string>([["legacy", "70"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    expect(readMigratedStorageValue(storage, "cassetteplay", ["legacy"], (value) => Number(value) === 70)).toBe("70");
    expect(values.get("cassetteplay")).toBe("70");
    expect(values.has("legacy")).toBe(false);
  });

  it("preserves the legacy value when writing the new key fails", () => {
    const values = new Map<string, string>([["legacy", "accepted"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: () => { throw new Error("quota"); }, removeItem: (key: string) => values.delete(key) };
    expect(readMigratedStorageValue(storage, "cassetteplay", ["legacy"], (value) => value === "accepted")).toBeNull();
    expect(values.get("legacy")).toBe("accepted");
  });

  it("does not migrate or remove invalid values", () => {
    const values = new Map<string, string>([["legacy", "secret-or-invalid"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    expect(readMigratedStorageValue(storage, "cassetteplay", ["legacy"], (value) => value === "accepted")).toBeNull();
    expect(values.get("legacy")).toBe("secret-or-invalid");
  });
});
