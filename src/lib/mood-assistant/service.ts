import "server-only";

import { performance } from "node:perf_hooks";
import { configuredMoodInterpreter } from "@/lib/mood-assistant/provider";
import { RulesMoodInterpreter } from "@/lib/mood-assistant/rules";
import { fetchMoodCandidates } from "@/lib/mood-assistant/repository";
import { rankMoodPlaylist } from "@/lib/mood-assistant/recommendation";
import { moodIntentSchema, type MoodAssistantRequest, type MoodAssistantResponse, type MoodCandidate, type MoodInterpreter } from "@/lib/mood-assistant/types";

type GenerationDependencies = {
  provider?: MoodInterpreter | null;
  fallback?: MoodInterpreter;
  candidates?: (intent: ReturnType<typeof moodIntentSchema.parse>) => Promise<MoodCandidate[]>;
  now?: () => number;
  generationId?: () => string;
};

function assistantSummary(intent: ReturnType<typeof moodIntentSchema.parse>, count: number) {
  const details = [
    intent.languages.length > 0 ? intent.languages.map((code) => code === "te" ? "Telugu" : code === "hi" ? "Hindi" : code === "en" ? "English" : code.toUpperCase()).join("/") : null,
    intent.moods[0]?.replaceAll("-", " ") ?? null,
    intent.occasions[0]?.replaceAll("-", " ") ?? null,
  ].filter(Boolean);
  return count > 0
    ? `I found ${count} verified ${details.join(" + ")} catalogue matches.`
    : "I could not find enough verified catalogue matches. Try a broader mood, language or era.";
}

async function interpretWithFallback(request: MoodAssistantRequest, dependencies: GenerationDependencies) {
  const fallback = dependencies.fallback ?? new RulesMoodInterpreter();
  const provider = dependencies.provider === undefined ? configuredMoodInterpreter() : dependencies.provider;
  if (!provider) return { intent: await fallback.interpret({ message: request.message, selections: request.selections }, request.conversationContext), providerMode: "fallback" as const };
  try {
    const intent = moodIntentSchema.parse(await provider.interpret({ message: request.message, selections: request.selections }, request.conversationContext));
    return { intent, providerMode: "provider" as const };
  } catch {
    return { intent: await fallback.interpret({ message: request.message, selections: request.selections }, request.conversationContext), providerMode: "fallback" as const };
  }
}

export async function generateMoodPlaylist(request: MoodAssistantRequest, dependencies: GenerationDependencies = {}): Promise<MoodAssistantResponse> {
  const now = dependencies.now ?? performance.now.bind(performance);
  const startedAt = now();
  const interpreted = await interpretWithFallback(request, dependencies);
  const interpretationFinishedAt = now();
  const generationId = dependencies.generationId?.() ?? crypto.randomUUID();

  if (interpreted.intent.clarificationRequired) {
    const totalMs = Math.max(0, now() - startedAt);
    const { confidence: _confidence, ...publicIntent } = interpreted.intent;
    void _confidence;
    return {
      ok: true,
      generationId,
      intent: publicIntent,
      assistantResponse: interpreted.intent.clarificationQuestion ?? "What would you like to hear?",
      playlist: [],
      playlistDurationSeconds: 0,
      clarificationRequired: true,
      clarificationQuestion: interpreted.intent.clarificationQuestion,
      providerMode: interpreted.providerMode,
      timings: { interpretationMs: interpretationFinishedAt - startedAt, catalogueMs: 0, rankingMs: 0, totalMs },
    };
  }

  const candidateStartedAt = interpretationFinishedAt;
  const candidates = await (dependencies.candidates ?? fetchMoodCandidates)(interpreted.intent);
  const candidateFinishedAt = now();
  const ranked = rankMoodPlaylist(candidates, interpreted.intent, request.currentQueueIds);
  const rankingFinishedAt = now();
  const { confidence: _confidence, ...publicIntent } = interpreted.intent;
  void _confidence;
  return {
    ok: true,
    generationId,
    intent: publicIntent,
    assistantResponse: assistantSummary(interpreted.intent, ranked.playlist.length),
    playlist: ranked.playlist,
    playlistDurationSeconds: ranked.durationSeconds,
    clarificationRequired: false,
    clarificationQuestion: null,
    providerMode: interpreted.providerMode,
    timings: {
      interpretationMs: interpretationFinishedAt - startedAt,
      catalogueMs: candidateFinishedAt - candidateStartedAt,
      rankingMs: rankingFinishedAt - candidateFinishedAt,
      totalMs: rankingFinishedAt - startedAt,
    },
  };
}
