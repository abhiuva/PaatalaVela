export function getPublicSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function hasPublicSupabaseEnv() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return Boolean(url && anonKey);
}

export function getServerSecretEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    sentimentApiUrl: process.env.SENTIMENT_API_URL,
    sentimentApiKey: process.env.SENTIMENT_API_KEY,
  };
}
