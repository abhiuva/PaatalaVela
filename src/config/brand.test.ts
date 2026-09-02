import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BRAND, LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/config/brand";
import { GET as getManifest } from "@/app/manifest.webmanifest/route";

describe("CassettePlay brand configuration", () => {
  it("uses the approved exact product name", () => {
    expect(BRAND.name).toBe("CassettePlay");
    expect(BRAND.shortName).toBe("CassettePlay");
  });

  it("uses versioned brand keys while retaining explicit compatibility keys", () => {
    expect(Object.values(STORAGE_KEYS).every((key) => key.startsWith("cassetteplay."))).toBe(true);
    expect(LEGACY_STORAGE_KEYS.shuffle).toContain("paatalavela.shuffle.v1");
  });

  it("publishes the approved name in the web app manifest", async () => {
    const manifest = await getManifest().json();
    expect(manifest).toMatchObject({ name: "CassettePlay", short_name: "CassettePlay" });
  });

  it("contains no retired platform name in active user-facing source", () => {
    const roots = [join(process.cwd(), "src/app"), join(process.cwd(), "src/components")];
    const files: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) files.push(path);
      }
    };
    roots.forEach(visit);
    const retiredName = ["Paatala", "Vela"].join("[ _]?");
    const retired = new RegExp(`${retiredName}|Telugu Music (App|Radio)`, "i");
    const offenders = files.filter((file) => retired.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
