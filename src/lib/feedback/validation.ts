import { z } from "zod";
import { uuidSchema } from "@/lib/validation/uuid";

export const feedbackCategories = [
  "music_selection",
  "playback",
  "channel_experience",
  "design",
  "performance",
  "other",
] as const;

const optionalUuid = uuidSchema.nullish().transform((value) => value ?? null);
const optionalChannelUuid = z.string()
  .uuid({ error: "Select a valid catalogue channel or submit general feedback." })
  .nullish()
  .transform((value) => value ?? null);
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);

export const feedbackInputSchema = z.object({
  rating: z.coerce.number({ error: "Choose an overall rating from 1 to 5." }).int().min(1).max(5),
  comment: optionalText(1000),
  category: z.union([z.enum(feedbackCategories), z.literal("")]).nullish().transform((value) => value || null),
  channelId: optionalChannelUuid,
  songId: optionalUuid,
  pagePath: optionalText(300),
  anonymousSessionId: optionalText(120),
  appVersion: optionalText(120),
  submissionToken: z.string().uuid(),
  website: optionalText(200),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export function satisfactionFromRating(rating: number) {
  if (rating <= 2) return "dissatisfied" as const;
  if (rating === 3) return "neutral" as const;
  return "satisfied" as const;
}

export function formatFeedbackValidationError(error: z.ZodError) {
  const issue = error.issues[0];
  const field = String(issue?.path[0] ?? "feedback");
  return {
    code: `FEEDBACK_${field.toUpperCase()}_INVALID`,
    field,
    message: issue?.message || "Review this field and try again.",
  };
}
