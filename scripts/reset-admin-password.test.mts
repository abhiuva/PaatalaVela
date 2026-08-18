import { describe, expect, it, vi } from "vitest";
import { runResetAdminPassword } from "./reset-admin-password.mjs";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-value",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_NEW_PASSWORD: "NewPassword123",
};

function createMockService({
  users = [{ id: "user-1", email: "admin@example.com" }],
  profile = { id: "user-1", role: "admin", active: true },
  updateError = null,
}: {
  users?: Array<{ id: string; email?: string }>;
  profile?: { id: string; role: string; active: boolean } | null;
  updateError?: { message: string } | null;
} = {}) {
  const listUsers = vi.fn().mockResolvedValue({ data: { users }, error: null });
  const updateUserById = vi.fn().mockResolvedValue({ data: { user: users[0] }, error: updateError });
  const createUser = vi.fn();
  const single = vi.fn().mockResolvedValue({ data: profile, error: null });
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single,
  };
  const from = vi.fn(() => builder);
  const service = {
    auth: {
      admin: {
        listUsers,
        updateUserById,
        createUser,
      },
    },
    from,
  };

  return { service, listUsers, updateUserById, createUser, from, builder };
}

async function runWithMock(env: Record<string, string | undefined>, mock = createMockService()) {
  const output: string[] = [];
  await runResetAdminPassword({
    env,
    createSupabaseClient: vi.fn(() => mock.service),
    stdout: (line: string) => output.push(line),
  });
  return { output, mock };
}

describe("reset-admin-password script", () => {
  it("rejects missing email", async () => {
    await expect(runWithMock({ ...validEnv, ADMIN_EMAIL: "" })).rejects.toThrow("ADMIN_EMAIL is required");
  });

  it("rejects missing password", async () => {
    await expect(runWithMock({ ...validEnv, ADMIN_NEW_PASSWORD: "" })).rejects.toThrow("ADMIN_NEW_PASSWORD is required");
  });

  it("rejects a short password", async () => {
    await expect(runWithMock({ ...validEnv, ADMIN_NEW_PASSWORD: "short" })).rejects.toThrow("ADMIN_NEW_PASSWORD must be at least 12 characters");
  });

  it("rejects an unknown user", async () => {
    const mock = createMockService({ users: [] });
    await expect(runWithMock(validEnv, mock)).rejects.toThrow("Auth user not found");
    expect(mock.updateUserById).not.toHaveBeenCalled();
  });

  it("updates an existing user password", async () => {
    const mock = createMockService();
    const { output } = await runWithMock(validEnv, mock);

    expect(mock.updateUserById).toHaveBeenCalledWith("user-1", {
      password: validEnv.ADMIN_NEW_PASSWORD,
      email_confirm: true,
    });
    expect(output).toEqual([
      "Auth user found",
      "Password updated",
      "Email confirmed",
      "Admin profile verified",
      "Login URL: http://localhost:3000/admin/login",
    ]);
  });

  it("never creates a second user", async () => {
    const mock = createMockService();
    await runWithMock(validEnv, mock);
    expect(mock.createUser).not.toHaveBeenCalled();
  });

  it("rejects a non-admin profile", async () => {
    const mock = createMockService({ profile: { id: "user-1", role: "editor", active: true } });
    await expect(runWithMock(validEnv, mock)).rejects.toThrow("Admin profile verification failed: profile role is not admin");
    expect(mock.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects an inactive profile", async () => {
    const mock = createMockService({ profile: { id: "user-1", role: "admin", active: false } });
    await expect(runWithMock(validEnv, mock)).rejects.toThrow("Admin profile verification failed: profile is inactive");
    expect(mock.updateUserById).not.toHaveBeenCalled();
  });

  it("does not include secrets or passwords in successful output", async () => {
    const { output } = await runWithMock(validEnv);
    const printed = output.join("\n");

    expect(printed).not.toContain(validEnv.ADMIN_NEW_PASSWORD);
    expect(printed).not.toContain(validEnv.SUPABASE_SERVICE_ROLE_KEY);
    expect(printed).not.toContain(validEnv.NEXT_PUBLIC_SUPABASE_URL);
  });
});
