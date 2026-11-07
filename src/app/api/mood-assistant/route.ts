import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/feedback/rate-limit";
import { moodAssistantRequestSchema } from "@/lib/mood-assistant/types";
import { generateMoodPlaylist } from "@/lib/mood-assistant/service";
import { recordMoodGeneration } from "@/lib/mood-assistant/repository";

export const dynamic = "force-dynamic";

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const responseHeaders = { "Cache-Control": "no-store, max-age=0" };

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return digest(`${forwarded}:${agent}`);
}

export function resetMoodAssistantRateLimitForTests() {
  rateLimit.clear();
}

export async function POST(request: Request) {
  if (consumeRateLimit(rateLimit, requestFingerprint(request), Date.now(), 10, 5 * 60_000)) {
    return NextResponse.json({ ok: false, code: "MOOD_ASSISTANT_RATE_LIMITED", message: "Too many requests. Try again in a few minutes." }, { status: 429, headers: responseHeaders });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "MOOD_ASSISTANT_INVALID_JSON", message: "Review the request and try again." }, { status: 400, headers: responseHeaders });
  }
  const parsed = moodAssistantRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ ok: false, code: "MOOD_ASSISTANT_INVALID_INPUT", field: issue?.path.join(".") || "message", message: issue?.message ?? "Review the request and try again." }, { status: 400, headers: responseHeaders });
  }

  try {
    const result = await generateMoodPlaylist(parsed.data);
    const sessionHeader = request.headers.get("x-cassetteplay-session") ?? requestFingerprint(request);
    const status = result.clarificationRequired ? "clarification" : result.playlist.length > 0 ? "generated" : "empty";
    void recordMoodGeneration({
      id: result.generationId,
      sessionHash: digest(sessionHeader),
      intent: result.intent,
      providerMode: result.providerMode,
      resultCount: result.playlist.length,
      playlistDurationSeconds: result.playlistDurationSeconds,
      totalMs: Math.round(result.timings.totalMs),
      status,
    });
    return NextResponse.json(result, { headers: responseHeaders });
  } catch (error) {
    const code = error instanceof Error && error.message === "MOOD_CATALOGUE_NOT_CONFIGURED"
      ? "MOOD_ASSISTANT_NOT_CONFIGURED"
      : "MOOD_ASSISTANT_GENERATION_FAILED";
    console.error("Mood Assistant generation failed", { code });
    return NextResponse.json({ ok: false, code, message: "Mood Assistant is temporarily unavailable. Your radio is still available." }, { status: code === "MOOD_ASSISTANT_NOT_CONFIGURED" ? 503 : 500, headers: responseHeaders });
  }
}
