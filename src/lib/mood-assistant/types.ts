import { z } from "zod";
import { energyCodes, eraCodes, languageCodes, moodCodes, occasionCodes, valenceCodes } from "@/lib/catalogue/taxonomy";
import type { Song } from "@/types/radio";

const shortText = z.string().trim().min(1).max(120);

export const moodIntentSchema = z.object({
  moods: z.array(z.enum(moodCodes)).max(6).default([]),
  occasions: z.array(z.enum(occasionCodes)).max(6).default([]),
  languages: z.array(z.enum(languageCodes)).max(3).default([]),
  regions: z.array(shortText).max(5).default([]),
  durationMinutes: z.number().int().min(5).max(240).nullable().default(null),
  songCount: z.number().int().min(1).max(50).nullable().default(null),
  eras: z.array(z.enum(eraCodes)).max(4).default([]),
  singers: z.array(shortText).max(5).default([]),
  composers: z.array(shortText).max(5).default([]),
  energy: z.enum(energyCodes).nullable().default(null),
  valence: z.enum(valenceCodes).nullable().default(null),
  exclusions: z.array(shortText).max(10).default([]),
  confidence: z.number().min(0).max(1),
  clarificationRequired: z.boolean(),
  clarificationQuestion: z.string().trim().max(180).nullable(),
}).strict().superRefine((value, context) => {
  if (value.clarificationRequired && !value.clarificationQuestion) {
    context.addIssue({ code: "custom", path: ["clarificationQuestion"], message: "A clarification question is required." });
  }
  if (!value.clarificationRequired && value.clarificationQuestion) {
    context.addIssue({ code: "custom", path: ["clarificationQuestion"], message: "Unexpected clarification question." });
  }
});

export type MoodIntent = z.infer<typeof moodIntentSchema>;
export type PublicMoodIntent = Omit<MoodIntent, "confidence">;

export type MoodConversationTurn = {
  role: "listener" | "assistant";
  content: string;
};

export type MoodStructuredSelections = {
  language?: (typeof languageCodes)[number];
  durationMinutes?: number;
  songCount?: number;
};

export type MoodInterpretationInput = {
  message: string;
  selections?: MoodStructuredSelections;
};

export interface MoodInterpreter {
  interpret(input: MoodInterpretationInput, conversationContext: readonly MoodConversationTurn[]): Promise<MoodIntent>;
}

export type MoodCandidate = Song & {
  energy: (typeof energyCodes)[number] | null;
  valence: (typeof valenceCodes)[number] | null;
  regions: string[];
  classificationConfidence: number | null;
  classificationSource: "editorial" | "admin-approved" | null;
};

export type MoodPlaylistItem = {
  song: Song;
  reason: string;
};

export type MoodAssistantResponse = {
  ok: true;
  generationId: string;
  intent: PublicMoodIntent;
  assistantResponse: string;
  playlist: MoodPlaylistItem[];
  playlistDurationSeconds: number;
  clarificationRequired: boolean;
  clarificationQuestion: string | null;
  providerMode: "provider" | "fallback";
  timings: {
    interpretationMs: number;
    catalogueMs: number;
    rankingMs: number;
    totalMs: number;
  };
};

export const moodAssistantRequestSchema = z.object({
  message: z.string().trim().min(1, "Describe what you want to hear.").max(500, "Keep the request under 500 characters."),
  selections: z.object({
    language: z.enum(languageCodes).optional(),
    durationMinutes: z.number().int().min(5).max(240).optional(),
    songCount: z.number().int().min(1).max(50).optional(),
  }).strict().optional(),
  conversationContext: z.array(z.object({
    role: z.enum(["listener", "assistant"]),
    content: z.string().trim().min(1).max(300),
  }).strict()).max(4).default([]),
  currentQueueIds: z.array(z.string().uuid()).max(100).default([]),
}).strict();

export type MoodAssistantRequest = z.infer<typeof moodAssistantRequestSchema>;
