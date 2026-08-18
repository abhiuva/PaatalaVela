import { describe, expect, it } from "vitest";
import { adminAccessState, GENERIC_LOGIN_ERROR, isActiveAdministrator } from "@/lib/admin/authorization";

describe("administrator authorization", () => {
  it("permits only a valid active administrator profile", () => {
    expect(isActiveAdministrator({ role: "admin", active: true })).toBe(true);
    expect(adminAccessState(true, { role: "admin", active: true })).toBe("authorized");
  });

  it("denies non-admin and inactive profiles", () => {
    expect(adminAccessState(true, { role: "editor", active: true })).toBe("unauthorized");
    expect(adminAccessState(true, { role: "admin", active: false })).toBe("unauthorized");
  });

  it("treats an expired or absent Auth session as unauthenticated", () => {
    expect(adminAccessState(false, { role: "admin", active: true })).toBe("unauthenticated");
    expect(GENERIC_LOGIN_ERROR).toBe("Unable to sign in with those credentials.");
  });
});
