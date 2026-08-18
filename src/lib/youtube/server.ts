import "server-only";

import { mapVideoItemToMetadata, parseYouTubePlaylistInput, type YouTubeVideoApiItem, type YouTubeVideoMetadata } from "@/lib/youtube/import";

type YouTubeVideosResponse = {
  items?: YouTubeVideoApiItem[];
  error?: { message?: string };
};

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      resourceId?: {
        videoId?: string;
      };
    };
  }>;
  error?: { message?: string };
};

function getYouTubeApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YouTube import is not configured. Add YOUTUBE_API_KEY on the server.");
  }
  return apiKey;
}

async function fetchYouTubeJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error("YouTube API request failed.");
  }
  return body;
}

export async function fetchYouTubeVideoMetadata(videoIds: string[]): Promise<YouTubeVideoMetadata[]> {
  const apiKey = getYouTubeApiKey();
  const uniqueIds = [...new Set(videoIds)].filter(Boolean);
  if (uniqueIds.length === 0) return [];

  const batches: YouTubeVideoMetadata[] = [];
  for (let index = 0; index < uniqueIds.length; index += 50) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("id", uniqueIds.slice(index, index + 50).join(","));
    url.searchParams.set("key", apiKey);

    const body = await fetchYouTubeJson<YouTubeVideosResponse>(url);
    batches.push(...(body.items ?? []).map(mapVideoItemToMetadata));
  }

  return batches;
}

export async function fetchOneYouTubeVideoMetadata(videoId: string) {
  const [metadata] = await fetchYouTubeVideoMetadata([videoId]);
  if (!metadata) {
    throw new Error("YouTube video was not found or is not accessible through the Data API.");
  }
  return metadata;
}

export async function fetchYouTubePlaylistVideoIds(input: string) {
  const playlistId = parseYouTubePlaylistInput(input);
  if (!playlistId) {
    throw new Error("Use a valid YouTube playlist URL or playlist ID.");
  }

  const apiKey = getYouTubeApiKey();
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const body = await fetchYouTubeJson<YouTubePlaylistItemsResponse>(url);
    for (const item of body.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) videoIds.push(videoId);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return { playlistId, videoIds };
}
