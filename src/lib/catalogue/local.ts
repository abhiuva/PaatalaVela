import { channels } from "@/data/channels";
import type { CatalogueDiagnosticCode, PublicCatalogue } from "@/lib/catalogue/types";

export function getLocalCatalogue(reason = "Supabase catalogue is unavailable. Local read-only fallback is active.", diagnosticCode: CatalogueDiagnosticCode = "CATALOGUE_QUERY_FAILED"): PublicCatalogue {
  return {
    channels,
    source: "local",
    fallbackReason: reason,
    diagnosticCode,
  };
}

export function getEmptyCatalogue(reason = "Loading production catalogue.", diagnosticCode: CatalogueDiagnosticCode = "CATALOGUE_LOADING"): PublicCatalogue {
  return {
    channels: channels.map((channel) => ({ ...channel, songs: [] })),
    source: "supabase",
    fallbackReason: reason,
    diagnosticCode,
  };
}
