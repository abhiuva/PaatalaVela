import { describe, expect, it } from "vitest";
import { hasSentimentConfiguration, validateSentimentResult } from "@/lib/feedback/sentiment-schema";

describe("multilingual sentiment contract", () => {
  it("accepts structured output independent of comment language", () => {
    for (const summary of ["తెలుగు వ్యాఖ్య సానుకూలంగా ఉంది", "The listener liked it", "Songs bagunnayi, playback slow ga undi"]) {
      expect(validateSentimentResult({ label: "mixed", score: 0.2, confidence: 0.82, summary, themes: ["music", "playback"] }).success).toBe(true);
    }
  });

  it("rejects unbounded scores and incomplete provider output", () => {
    expect(validateSentimentResult({ label: "positive", score: 2, confidence: 1, summary: "Good", themes: [] }).success).toBe(false);
    expect(validateSentimentResult({ label: "positive" }).success).toBe(false);
  });

  it("leaves sentiment pending when provider configuration is absent", () => {
    expect(hasSentimentConfiguration(undefined, undefined)).toBe(false);
    expect(hasSentimentConfiguration("https://provider.example", undefined)).toBe(false);
    expect(hasSentimentConfiguration("https://provider.example", "secret")).toBe(true);
  });

});
