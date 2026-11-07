import { moodIntentSchema, type MoodConversationTurn, type MoodIntent, type MoodInterpretationInput, type MoodInterpreter } from "@/lib/mood-assistant/types";
import type { EnergyCode, LanguageCode, MoodCode, OccasionCode, ValenceCode } from "@/lib/catalogue/taxonomy";

const languageTerms: Record<LanguageCode, string[]> = {
  te: ["telugu", "తెలుగు"],
  hi: ["hindi", "हिन्दी", "हिंदी"],
  en: ["english"],
  ta: ["tamil", "தமிழ்"],
  ml: ["malayalam", "മലയാളം"],
};

const moodTerms: Record<MoodCode, string[]> = {
  happy: ["happy", "cheerful", "feel good"],
  sad: ["sad", "heartbroken"],
  breakup: ["breakup", "break up", "separation"],
  romantic: ["romantic", "romance", "love songs"],
  nostalgic: ["nostalgic", "nostalgia", "old memories", "classics"],
  peaceful: ["peaceful", "calm", "relaxing", "soft", "melody", "melodies"],
  devotional: ["devotional", "spiritual", "bhakti", "భక్తి"],
  energetic: ["energetic", "energy", "mass", "upbeat"],
  celebratory: ["celebratory", "celebrate", "festive"],
  reflective: ["reflective", "thoughtful", "introspective"],
  melancholic: ["melancholic", "melancholy", "very sad"],
  uplifting: ["uplifting", "hopeful", "positive"],
};

const occasionTerms: Record<OccasionCode, string[]> = {
  rain: ["rain", "rainy", "monsoon"],
  driving: ["driving", "drive", "road trip", "highway"],
  party: ["party", "dance"],
  work: ["work", "working", "focus"],
  workout: ["workout", "gym", "exercise", "running"],
  sleep: ["sleep", "bedtime"],
  morning: ["morning", "sunrise"],
  afternoon: ["afternoon"],
  evening: ["evening", "sunset"],
  "late-night": ["late night", "late-night", "midnight"],
  prayer: ["prayer", "pooja", "puja"],
  celebration: ["celebration", "festival", "wedding"],
  "tea-time": ["tea time", "tea-time", "chai"],
};

function includesTerm(text: string, term: string) {
  return text.includes(term);
}

function matchingCodes<T extends string>(text: string, terms: Record<T, string[]>) {
  return (Object.entries(terms) as Array<[T, string[]]>)
    .filter(([, aliases]) => aliases.some((alias) => includesTerm(text, alias)))
    .map(([code]) => code);
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function requestedDuration(text: string) {
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const minutes = text.match(/(\d{1,3})\s*(?:minutes?|mins?)\b/);
  return minutes ? Number(minutes[1]) : null;
}

function requestedSongCount(text: string) {
  const match = text.match(/\b(\d{1,2})\b[^.!?]{0,40}\b(?:songs?|tracks?)\b/);
  return match ? Number(match[1]) : null;
}

function requestedEras(text: string) {
  const eras = [...text.matchAll(/\b(19[89]0s|20[012]0s)\b/g)].map((match) => match[1]);
  return unique(eras).filter((era): era is MoodIntent["eras"][number] => ["1980s", "1990s", "2000s", "2010s", "2020s"].includes(era));
}

function captureNames(text: string, expression: RegExp) {
  const value = text.match(expression)?.[1]?.trim();
  return value ? [value.replace(/[.,!?]+$/, "").slice(0, 120)] : [];
}

function inferEnergy(text: string): EnergyCode | null {
  if (/\b(high energy|very energetic|energetic|workout|gym|party|mass|upbeat)\b/.test(text)) return "high";
  if (/\b(low energy|calm|peaceful|sleep|soft)\b/.test(text)) return "low";
  if (/\b(medium energy|moderate)\b/.test(text)) return "medium";
  return null;
}

function inferValence(text: string): ValenceCode | null {
  if (/\b(neutral|balanced|not too sad|don't give me extremely sad|dont give me extremely sad)\b/.test(text)) return "neutral";
  if (/\b(happy|uplifting|hopeful|positive|celebrat)/.test(text)) return "positive";
  if (/\b(sad|melanchol|heartbroken|breakup|break up)\b/.test(text)) return "negative";
  return null;
}

function inferExclusions(text: string) {
  const exclusions: string[] = [];
  const negativePrefix = /(avoid|without|no |not |don't|dont)/;
  if (negativePrefix.test(text) && /(extremely sad|very sad|melanchol)/.test(text)) exclusions.push("melancholic");
  if (negativePrefix.test(text) && /sad songs?/.test(text)) exclusions.push("sad");
  if (negativePrefix.test(text) && /romantic/.test(text)) exclusions.push("romantic");
  if (negativePrefix.test(text) && /high energy|energetic/.test(text)) exclusions.push("energetic");
  return unique(exclusions);
}

export function parseMoodIntent(input: MoodInterpretationInput, context: readonly MoodConversationTurn[] = []): MoodIntent {
  const priorListenerText = context.filter((turn) => turn.role === "listener").map((turn) => turn.content).join(" ");
  const text = `${priorListenerText} ${input.message}`.toLocaleLowerCase("en-IN");
  const languages = matchingCodes(text, languageTerms);
  if (input.selections?.language) languages.push(input.selections.language);
  const moods = matchingCodes(text, moodTerms);
  const occasions = matchingCodes(text, occasionTerms);
  const durationMinutes = input.selections?.durationMinutes ?? requestedDuration(text);
  const songCount = input.selections?.songCount ?? requestedSongCount(text);
  const singers = captureNames(text, /(?:songs?\s+by|singer\s+)([\p{L}][\p{L}\s.'-]{1,80})/u);
  const composers = captureNames(text, /(?:composed\s+by|composer\s+)([\p{L}][\p{L}\s.'-]{1,80})/u);
  const exclusions = inferExclusions(text);
  const usefulSignals = moods.length + occasions.length + languages.length + requestedEras(text).length + singers.length + composers.length + Number(Boolean(durationMinutes || songCount));
  const clarificationRequired = usefulSignals === 0;

  return moodIntentSchema.parse({
    moods: unique(moods).filter((mood) => !exclusions.includes(mood)),
    occasions: unique(occasions),
    languages: unique(languages),
    regions: matchingCodes(text, {
      "andhra-pradesh": ["andhra", "andhra pradesh"],
      telangana: ["telangana"],
      "south-india": ["south indian", "south india"],
      "north-india": ["north indian", "north india"],
      global: ["international", "global"],
    }),
    durationMinutes,
    songCount,
    eras: requestedEras(text),
    singers,
    composers,
    energy: inferEnergy(text),
    valence: inferValence(text),
    exclusions,
    confidence: clarificationRequired ? 0.25 : usefulSignals >= 3 ? 0.9 : 0.72,
    clarificationRequired,
    clarificationQuestion: clarificationRequired ? "What mood or language would you like right now?" : null,
  });
}

export class RulesMoodInterpreter implements MoodInterpreter {
  async interpret(input: MoodInterpretationInput, conversationContext: readonly MoodConversationTurn[]) {
    return parseMoodIntent(input, conversationContext);
  }
}
