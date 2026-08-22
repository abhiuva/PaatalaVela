import { z } from "zod";
import type { ChannelSlug } from "@/types/radio";
import { eraCodes, languageCodes, moodCodes, occasionCodes } from "@/lib/catalogue/taxonomy";

export const youtubeVideoIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{11}$/, "Use an 11-character YouTube video ID.");

export function extractYouTubeVideoId(value: string) {
  const trimmed = value.trim();
  if (youtubeVideoIdSchema.safeParse(trimmed).success) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") {
      return youtubeVideoIdSchema.parse(url.pathname.split("/").filter(Boolean)[0] ?? "");
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "music.youtube.com" || hostname === "youtube-nocookie.com") {
      const segments = url.pathname.split("/").filter(Boolean);
      const id = url.searchParams.get("v") ?? (segments[0] === "shorts" || segments[0] === "embed" ? segments[1] : "");
      return youtubeVideoIdSchema.parse(id ?? "");
    }
  } catch {
    return null;
  }

  return null;
}

const nullableStringInput = (max: number, label: string) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? "" : value),
    z
      .string()
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`),
  );

export const optionalTextSchema = (max: number, label: string) =>
  nullableStringInput(max, label).transform((value) => (value ? value : ""));

export const nullableTextSchema = (max: number, label: string) =>
  nullableStringInput(max, label).transform((value) => (value ? value : null));

export const requiredTextSchema = (label: string, max: number) =>
  z.preprocess(
    (value) => (value === null ? "" : value),
    z
      .string({ error: `${label} is required.` })
      .trim()
      .min(1, `${label} is required.`)
      .max(max, `${label} must be ${max} characters or fewer.`),
  );

export const externalUrlSchema = z
  .preprocess((value) => (value === null || value === undefined ? "" : value), z.string().trim())
  .transform((value) => (value ? value : null))
  .refine((value) => !value || /^https:\/\/[^\s]+$/i.test(value), "Use a valid HTTPS URL.");

export const songInputSchema = z.object({
  title: requiredTextSchema("Title", 180),
  teluguTitle: optionalTextSchema(180, "Telugu title"),
  film: requiredTextSchema("Film", 180),
  releaseYear: z.coerce.number().int().min(1900).max(2100),
  durationSeconds: z.coerce.number().int().positive("Duration must be a positive number of seconds."),
  singers: requiredTextSchema("At least one singer", 1000),
  composer: requiredTextSchema("Composer", 180),
  lyricist: optionalTextSchema(180, "Lyricist"),
  youtubeInput: requiredTextSchema("YouTube URL or video ID", 300),
  spotifyUrl: externalUrlSchema,
  youtubeMusicUrl: externalUrlSchema,
  editorialNote: optionalTextSchema(1000, "Editorial note"),
  editorialNoteTelugu: optionalTextSchema(1000, "Telugu editorial note"),
  languageCode: z.enum(languageCodes, { error: "Choose a supported language." }),
  eraCode: z.enum(eraCodes, { error: "Choose a supported era." }),
  moodCodes: z.array(z.enum(moodCodes)).max(moodCodes.length),
  occasionCodes: z.array(z.enum(occasionCodes)).max(occasionCodes.length),
  songStory: optionalTextSchema(320, "Song story"),
  context: optionalTextSchema(240, "Context"),
  thumbnailUrl: externalUrlSchema,
  embedStatus: z.enum(["unchecked", "available", "unavailable", "embedding_disabled", "region_restricted"]),
  channelIds: z.array(z.string()).default([]),
});

export const taxonomyInputSchema = z.object({
  languageCode: z.enum(languageCodes, { error: "Choose a supported language." }),
  eraCode: z.enum(eraCodes, { error: "Choose a supported era." }),
  moodCodes: z.array(z.enum(moodCodes)).max(moodCodes.length),
  occasionCodes: z.array(z.enum(occasionCodes)).max(occasionCodes.length),
  songStory: optionalTextSchema(320, "Song story"),
  context: optionalTextSchema(240, "Context"),
});

export const channelInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  teluguName: z.string().trim().min(1).max(120),
  positioning: z.string().trim().min(1).max(260),
  backgroundImageUrl: externalUrlSchema,
  primaryColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i),
  secondaryColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i),
  accentColor: z.string().trim().regex(/^#[0-9a-f]{6}$/i),
  displayOrder: z.coerce.number().int().min(1).max(99),
});

export const takedownInputSchema = z.object({
  songOrYoutubeUrl: z.string().trim().min(1).max(300),
  claimantName: z.string().trim().min(2).max(120),
  claimantEmail: z.string().trim().email().max(180),
  rightsHolder: z.string().trim().min(2).max(180),
  requestDetails: z.string().trim().min(20).max(3000),
  evidenceUrl: externalUrlSchema,
  confirmation: z.literal("on", { error: "Confirm that the submitted information is accurate." }),
  company: z.string().max(0, "Submission rejected."),
});

export const sponsorInputSchema = z.object({
  sponsorId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  logoUrl: externalUrlSchema,
  websiteUrl: z.string().trim().url().refine((value) => value.startsWith("https://"), "Sponsor website must use HTTPS."),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const sponsorCampaignInputSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    sponsorId: z.string().uuid(),
    campaignName: z.string().trim().min(1).max(180),
    placementType: z.enum(["homepage", "channel", "now_playing", "schedule", "footer"]),
    channelId: z.string().uuid().optional().or(z.literal("")),
    headline: z.string().trim().min(1).max(180),
    description: z.string().trim().max(400).optional(),
    imageUrl: externalUrlSchema,
    destinationUrl: z.string().trim().url().refine((value) => value.startsWith("https://"), "Destination URL must use HTTPS."),
    startAt: z.string().trim().min(1),
    endAt: z.string().trim().min(1),
    priority: z.coerce.number().int().min(0).max(1000),
    status: z.enum(["draft", "scheduled", "active", "paused", "completed"]),
  })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), "End time must be later than start time.")
  .refine((value) => value.placementType !== "channel" || Boolean(value.channelId), "Channel campaigns must target one channel.");

export const songRequestInputSchema = z.object({
  songName: z.string().trim().min(1).max(180),
  filmName: z.string().trim().min(1).max(180),
  singer: z.string().trim().max(180).optional(),
  youtubeUrl: externalUrlSchema,
  requestedChannelId: z.string().trim().min(1).max(120),
  reason: z.string().trim().max(500).optional(),
  company: z.string().max(0, "Submission rejected."),
});

export function isLockedChannelSlug(value: string): value is ChannelSlug {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}
