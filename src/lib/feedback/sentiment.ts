import "server-only";

import { getServerSecretEnv } from "@/lib/env";
import { hasSentimentConfiguration, validateSentimentResult, type SentimentResult } from "@/lib/feedback/sentiment-schema";

export type SentimentProvider = {
  name: string;
  analyse(comment: string): Promise<SentimentResult>;
};

export function getSentimentProvider(): SentimentProvider | null {
  const { sentimentApiUrl, sentimentApiKey } = getServerSecretEnv();
  if (!hasSentimentConfiguration(sentimentApiUrl, sentimentApiKey)) return null;
  const providerUrl = sentimentApiUrl as string;
  const providerKey = sentimentApiKey as string;

  return {
    name: "configured-http-provider",
    async analyse(comment) {
      const response = await fetch(providerUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${providerKey}` },
        body: JSON.stringify({
          task: "multilingual_sentiment",
          languages: ["te", "en", "transliterated-te", "mixed"],
          comment,
          output: { label: "positive|neutral|negative|mixed", score: "-1..1", confidence: "0..1", summary: "short", themes: [] },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("SENTIMENT_PROVIDER_REQUEST_FAILED");
      const parsed = validateSentimentResult(await response.json());
      if (!parsed.success) throw new Error("SENTIMENT_PROVIDER_RESPONSE_INVALID");
      return parsed.data;
    },
  };
}

export function sentimentProviderConfigured() {
  return Boolean(getSentimentProvider());
}
