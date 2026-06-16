// Prompt tags are free-form strings (see Prompt.tags). These bounds and the
// palette are the single source of truth shared by the api (normalization +
// validation) and the web (picker + colored chips).

export const TAG_MAX_LEN = 30; // characters per tag (after trim)
export const TAG_MAX = 20; // tags per prompt

// Deterministic chip colors — a tag is hashed to one of these (tagColor()).
// Brand orange (#FF6B1A) is intentionally excluded; it's reserved for CTAs.
export const TAG_PALETTE: string[] = [
  '#0a84ff', // blue
  '#14b8a6', // teal
  '#7c5cff', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#22c55e', // green
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#8b5cf6', // indigo-violet
  '#10b981', // emerald
  '#e6539a', // magenta
];
