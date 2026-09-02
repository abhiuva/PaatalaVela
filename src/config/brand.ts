export const BRAND = Object.freeze({
  name: "CassettePlay",
  shortName: "CassettePlay",
  description: "Curated Telugu, English and Hindi music channels powered by official YouTube embeds.",
  legacyProductionUrl: "https://paatalavela-cdb29a.netlify.app",
});

export const STORAGE_KEYS = Object.freeze({
  playback: "cassetteplay.playback.v1",
  volume: "cassetteplay.volume.v1",
  shuffle: "cassetteplay.shuffle.v2",
  analyticsConsent: "cassetteplay.analytics-consent.v1",
  presenceSession: "cassetteplay.presence-session.v1",
  browserSession: "cassetteplay.session.v1",
});

export const LEGACY_STORAGE_KEYS = Object.freeze({
  playback: ["telugu-radio.playback"],
  volume: ["telugu-radio.volume"],
  shuffle: ["paatalavela.shuffle.v1"],
  analyticsConsent: ["telugu-radio.analytics-consent"],
  presenceSession: ["paatalavela.presence-session"],
  browserSession: ["telugu-radio-session"],
});
