import { z } from "zod";

export const uuidSchema = z.string().uuid({ error: "Use a valid UUID." });

export function isUuid(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
}

export function uuidOrNull(value: unknown) {
  return isUuid(value) ? value : null;
}
