import type { Channel } from "@/types/radio";

export type CatalogueSource = "supabase" | "local";
export type CatalogueDiagnosticCode =
  | "CATALOGUE_LOADING"
  | "CATALOGUE_CONFIG_MISSING"
  | "CATALOGUE_QUERY_FAILED"
  | "CATALOGUE_RLS_DENIED"
  | "ACTIVE_CHANNELS_MISSING"
  | "CHANNEL_EMPTY"
  | "CHANNEL_ASSIGNMENT_INVALID";

export type PublicCatalogue = {
  channels: Channel[];
  source: CatalogueSource;
  fallbackReason?: string;
  diagnosticCode?: CatalogueDiagnosticCode;
};
