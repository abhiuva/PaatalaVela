export const languageCodes = ["te", "en", "hi", "ta", "ml"] as const;
export const eraCodes = ["pre-1980", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;
export const moodCodes = ["devotional", "peaceful", "nostalgic", "uplifting", "romantic", "melancholic", "energetic", "celebratory", "reflective"] as const;
export const occasionCodes = ["morning", "prayer", "tea-time", "afternoon", "evening", "celebration", "driving", "late-night"] as const;

export const languageOptions = [
  { code: "te", name: "Telugu" },
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "ml", name: "Malayalam" },
] as const;

export const eraOptions = [
  { code: "pre-1980", name: "Before 1980" },
  { code: "1980s", name: "1980s" },
  { code: "1990s", name: "1990s" },
  { code: "2000s", name: "2000s" },
  { code: "2010s", name: "2010s" },
  { code: "2020s", name: "2020s" },
] as const;

export const moodOptions = [
  { code: "devotional", name: "Devotional" },
  { code: "peaceful", name: "Peaceful" },
  { code: "nostalgic", name: "Nostalgic" },
  { code: "uplifting", name: "Uplifting" },
  { code: "romantic", name: "Romantic" },
  { code: "melancholic", name: "Melancholic" },
  { code: "energetic", name: "Energetic" },
  { code: "celebratory", name: "Celebratory" },
  { code: "reflective", name: "Reflective" },
] as const;

export const occasionOptions = [
  { code: "morning", name: "Morning" },
  { code: "prayer", name: "Prayer" },
  { code: "tea-time", name: "Tea time" },
  { code: "afternoon", name: "Afternoon" },
  { code: "evening", name: "Evening" },
  { code: "celebration", name: "Celebration" },
  { code: "driving", name: "Driving" },
  { code: "late-night", name: "Late night" },
] as const;

export type LanguageCode = (typeof languageCodes)[number];
export type EraCode = (typeof eraCodes)[number];
export type MoodCode = (typeof moodCodes)[number];
export type OccasionCode = (typeof occasionCodes)[number];

export function eraForYear(year: number): EraCode {
  if (year < 1980) return "pre-1980";
  if (year < 1990) return "1980s";
  if (year < 2000) return "1990s";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

export function sanitizeEditorialText(value: string | null | undefined, maxLength: number) {
  const sanitized = String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized ? sanitized.slice(0, maxLength) : null;
}
