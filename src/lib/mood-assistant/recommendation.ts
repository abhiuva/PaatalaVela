import type { MoodCandidate, MoodIntent, MoodPlaylistItem } from "@/lib/mood-assistant/types";

const DEFAULT_SONG_COUNT = 12;
const DURATION_TOLERANCE_SECONDS = 8 * 60;

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en-IN");
}

function intersects(left: readonly string[], right: readonly string[]) {
  const wanted = new Set(right.map(normalized));
  return left.some((value) => wanted.has(normalized(value)));
}

function includesName(values: readonly string[], wanted: readonly string[]) {
  if (wanted.length === 0) return true;
  return wanted.some((target) => values.some((value) => normalized(value).includes(normalized(target))));
}

function excluded(candidate: MoodCandidate, exclusions: readonly string[]) {
  const searchable = [candidate.title, candidate.film, candidate.composer, ...candidate.singers, ...candidate.moods, ...candidate.occasions, ...candidate.regions]
    .map(normalized)
    .join(" ");
  return exclusions.some((value) => searchable.includes(normalized(value)));
}

export function isEligibleMoodCandidate(candidate: MoodCandidate, intent: MoodIntent, excludedSongIds: ReadonlySet<string>) {
  if (excludedSongIds.has(candidate.id) || candidate.active === false || candidate.embedStatus !== "available") return false;
  if (!/^[A-Za-z0-9_-]{11}$/.test(candidate.youtubeVideoId)) return false;
  if (intent.durationMinutes && (!candidate.durationSeconds || candidate.durationSeconds <= 0)) return false;
  if (intent.languages.length > 0 && !intent.languages.includes(candidate.languageCode as MoodIntent["languages"][number])) return false;
  if (intent.eras.length > 0 && !intent.eras.includes(candidate.eraCode as MoodIntent["eras"][number])) return false;
  if (!includesName(candidate.singers, intent.singers)) return false;
  if (intent.composers.length > 0 && !includesName([candidate.composer], intent.composers)) return false;
  if (intent.regions.length > 0 && !intersects(candidate.regions, intent.regions)) return false;
  return !excluded(candidate, intent.exclusions);
}

function baseScore(candidate: MoodCandidate, intent: MoodIntent) {
  let score = 0;
  if (intent.moods.length === 0 || intersects(candidate.moods, intent.moods)) score += 30;
  if (intent.occasions.length === 0 || intersects(candidate.occasions, intent.occasions)) score += 20;

  let languageRegionScore = 0;
  if (intent.languages.length === 0 || intent.languages.includes(candidate.languageCode as MoodIntent["languages"][number])) languageRegionScore += 10;
  if (intent.regions.length === 0 || intersects(candidate.regions, intent.regions)) languageRegionScore += 5;
  score += languageRegionScore;

  if (!intent.energy || candidate.energy === intent.energy) score += 5;
  if (!intent.valence || candidate.valence === intent.valence) score += 5;

  let constraintScore = 0;
  if (intent.eras.length === 0 || intent.eras.includes(candidate.eraCode as MoodIntent["eras"][number])) constraintScore += 4;
  if (intent.singers.length === 0 || includesName(candidate.singers, intent.singers)) constraintScore += 3;
  if (intent.composers.length === 0 || includesName([candidate.composer], intent.composers)) constraintScore += 3;
  score += constraintScore;

  const confidence = candidate.classificationConfidence ?? 0.5;
  score += candidate.classificationSource === "editorial" || candidate.classificationSource === "admin-approved" ? 5 : 5 * confidence;
  return score;
}

function diversityScore(candidate: MoodCandidate, selected: readonly MoodCandidate[]) {
  if (selected.length === 0) return 10;
  const recent = selected.slice(-3);
  let score = 10;
  if (recent.some((song) => normalized(song.film) === normalized(candidate.film))) score -= 7;
  if (recent.some((song) => normalized(song.composer) === normalized(candidate.composer))) score -= 4;
  if (recent.some((song) => intersects(song.singers, candidate.singers))) score -= 4;
  return Math.max(-5, score);
}

function explanation(candidate: MoodCandidate, intent: MoodIntent) {
  const matched: string[] = [];
  const language = candidate.languageCode === "te" ? "Telugu" : candidate.languageCode === "hi" ? "Hindi" : candidate.languageCode === "en" ? "English" : candidate.languageCode.toUpperCase();
  if (intent.languages.length > 0) matched.push(language);
  const mood = intent.moods.find((value) => candidate.moods.includes(value));
  const occasion = intent.occasions.find((value) => candidate.occasions.includes(value));
  if (occasion) matched.push(occasion.replaceAll("-", " "));
  if (mood) matched.push(mood);
  if (intent.energy && candidate.energy === intent.energy) matched.push(`${intent.energy} energy`);
  if (intent.eras.includes(candidate.eraCode as MoodIntent["eras"][number])) matched.push(candidate.eraCode);
  return matched.length > 0 ? `Matched ${matched.join(" + ")}.` : "Strong catalogue match with balanced variety.";
}

export function rankMoodPlaylist(
  candidates: readonly MoodCandidate[],
  intent: MoodIntent,
  currentQueueIds: readonly string[] = [],
) {
  const excludedSongIds = new Set(currentQueueIds);
  const eligible = candidates
    .filter((candidate) => isEligibleMoodCandidate(candidate, intent, excludedSongIds))
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id || item.youtubeVideoId === candidate.youtubeVideoId) === index);
  const selected: MoodCandidate[] = [];
  const remaining = [...eligible];
  const targetCount = intent.songCount ?? (intent.durationMinutes ? 50 : DEFAULT_SONG_COUNT);
  const targetDurationSeconds = intent.durationMinutes ? intent.durationMinutes * 60 : null;
  let durationSeconds = 0;

  while (remaining.length > 0 && selected.length < targetCount) {
    remaining.sort((left, right) => {
      const scoreDifference = (baseScore(right, intent) + diversityScore(right, selected)) - (baseScore(left, intent) + diversityScore(left, selected));
      return scoreDifference || left.id.localeCompare(right.id);
    });
    const next = remaining.shift()!;
    const nextDuration = next.durationSeconds ?? 0;
    if (targetDurationSeconds && selected.length > 0 && durationSeconds >= targetDurationSeconds) break;
    if (targetDurationSeconds && durationSeconds + nextDuration > targetDurationSeconds + DURATION_TOLERANCE_SECONDS) {
      const fittingIndex = remaining.findIndex((candidate) => durationSeconds + (candidate.durationSeconds ?? 0) <= targetDurationSeconds + DURATION_TOLERANCE_SECONDS);
      if (fittingIndex >= 0) {
        const fitting = remaining.splice(fittingIndex, 1)[0];
        selected.push(fitting);
        durationSeconds += fitting.durationSeconds ?? 0;
        continue;
      }
      break;
    }
    selected.push(next);
    durationSeconds += nextDuration;
  }

  const playlist: MoodPlaylistItem[] = selected.map((candidate) => ({ song: candidate, reason: explanation(candidate, intent) }));
  return { playlist, durationSeconds, candidateCount: eligible.length };
}

export const moodDurationToleranceSeconds = DURATION_TOLERANCE_SECONDS;
