import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("admin and presence security boundaries", () => {
  it("uses Supabase password Auth, generic failures and secure logout", () => {
    const login = read("src/app/admin/login/actions.ts");
    const adminActions = read("src/app/admin/actions.ts");
    expect(login).toContain("signInWithPassword");
    expect(login).toContain("GENERIC_LOGIN_ERROR");
    expect(login).toContain('select("role, active")');
    expect(adminActions).toContain("auth.signOut()");
  });

  it("does not expose a signup route or call", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/admin/signup"))).toBe(false);
    expect(read("src/app/admin/login/actions.ts")).not.toContain("signUp(");
  });

  it("keeps service credentials out of browser modules", () => {
    const browserCode = [
      read("src/components/RadioPlayer.tsx"), read("src/components/presence/LiveListenerCount.tsx"),
      read("src/hooks/useListenerPresence.ts"), read("src/app/admin/login/LoginForm.tsx"),
    ].join("\n");
    expect(browserCode).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(browserCode).not.toContain("serviceRoleKey");
  });

  it("returns aggregate count fields and never public listener rows", () => {
    const route = read("src/app/api/presence/count/route.ts");
    expect(route).toContain("total: counts.total, channel: counts.channel");
    expect(route).not.toContain("session_hash");
    expect(route).not.toContain("anonymous_session_id");
  });

  it("keeps local secrets ignored and credentials out of migrations", () => {
    expect(read(".gitignore")).toContain(".env.local");
    const migrations = read("supabase/migrations/20260818143000_sprint6_1_active_listeners.sql");
    expect(migrations.toLowerCase()).not.toContain("password");
    expect(migrations).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
