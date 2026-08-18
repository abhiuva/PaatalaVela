import { describe, expect, it, vi } from "vitest";
import { runBootstrap, validateBootstrapInput } from "./bootstrap-admin.mjs";
import { randomUUID } from "node:crypto";

const env = {
  NODE_ENV: "test" as const,
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: `test-service-${randomUUID()}`,
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: `Aa1!${randomUUID().replaceAll("-", "")}`,
  ADMIN_DISPLAY_NAME: "Administrator",
};

function client(existingUser: { id: string; email: string } | null) {
  const user = existingUser ?? { id: "auth-user-id", email: env.ADMIN_EMAIL };
  const createUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const updateUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: user.id, role: "admin", active: true }, error: null });
  const service = {
    auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users: existingUser ? [existingUser] : [] }, error: null }), createUser, updateUserById } },
    from: vi.fn(() => ({ upsert, select: () => ({ eq: () => ({ maybeSingle }) }) })),
  };
  return { service, createUser, updateUserById };
}

describe("admin bootstrap", () => {
  it("requires all inputs and a password of at least 12 characters", () => {
    expect(() => validateBootstrapInput({ ...env, ADMIN_EMAIL: "" })).toThrow("ADMIN_BOOTSTRAP_MISSING_ADMIN_EMAIL");
    expect(() => validateBootstrapInput({ ...env, ADMIN_PASSWORD: "x".repeat(11) })).toThrow("ADMIN_BOOTSTRAP_PASSWORD_TOO_SHORT");
  });

  it("creates only a missing Auth user and verifies the matching admin profile", async () => {
    const mock = client(null);
    const output = vi.fn();
    await runBootstrap({ env, createClientImpl: (() => mock.service) as unknown as typeof import("@supabase/supabase-js").createClient, output });
    expect(mock.createUser).toHaveBeenCalledOnce();
    expect(mock.updateUserById).not.toHaveBeenCalled();
    expect(output.mock.calls.flat()).toEqual(["Auth user created", "Password configured", "Email confirmed", "Admin profile verified", "Login URL: http://localhost:3000/admin/login"]);
  });

  it("updates the existing Auth password without creating a second user", async () => {
    const mock = client({ id: "existing-id", email: env.ADMIN_EMAIL });
    const lines: string[] = [];
    await runBootstrap({ env, createClientImpl: (() => mock.service) as unknown as typeof import("@supabase/supabase-js").createClient, output: (line: string) => lines.push(line) });
    expect(mock.createUser).not.toHaveBeenCalled();
    expect(mock.updateUserById).toHaveBeenCalledWith("existing-id", expect.objectContaining({ email_confirm: true, password: env.ADMIN_PASSWORD }));
    const printed = lines.join("\n");
    expect(printed).not.toContain(env.ADMIN_PASSWORD);
    expect(printed).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
    expect(printed).not.toContain(env.ADMIN_EMAIL);
  });
});
