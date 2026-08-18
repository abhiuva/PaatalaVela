import type { EmbedStatus } from "@/types/database";

export function isPublicPlayableSong(active: boolean, embedStatus: EmbedStatus) {
  return active && embedStatus === "available";
}
