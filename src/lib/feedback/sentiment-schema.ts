import { z } from "zod";

export const sentimentResultSchema = z.object({
  label: z.enum(["positive", "neutral", "negative", "mixed"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1).max(500),
  themes: z.array(z.string().trim().min(1).max(80)).max(12),
});

export type SentimentResult = z.infer<typeof sentimentResultSchema>;

export function validateSentimentResult(value: unknown) {
  return sentimentResultSchema.safeParse(value);
}

export function hasSentimentConfiguration(url?: string, key?: string) {
  return Boolean(url && key);
}
