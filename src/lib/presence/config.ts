export const presenceConfig = {
  heartbeatMs: 30_000,
  sessionTimeoutMs: 90_000,
  countRefreshMs: 15_000,
  requestTimeoutMs: 8_000,
} as const;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function socialProofThresholds(env: Record<string, string | undefined> = process.env) {
  return {
    daily: positiveInteger(env.SOCIAL_PROOF_DAILY_THRESHOLD, 5),
    concurrent: positiveInteger(env.SOCIAL_PROOF_CONCURRENT_THRESHOLD, 25),
    channel: positiveInteger(env.SOCIAL_PROOF_CHANNEL_THRESHOLD, 10),
  };
}

export type SocialProofThresholds = ReturnType<typeof socialProofThresholds>;

export function indiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
