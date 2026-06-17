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

// A named, user-pickable label colour (Linear's label palette). Used by the
// label picker's "Pick a color" step. Brand orange (#FF6B1A) is intentionally
// excluded — it's reserved for CTAs/active state.
export interface LabelColor {
  name: string;
  value: string; // hex
}

export const LABEL_COLORS: LabelColor[] = [
  { name: 'Grey', value: '#bec2c8' },
  { name: 'Dark Grey', value: '#7c8290' },
  { name: 'Purple', value: '#5e6ad2' },
  { name: 'Teal', value: '#00b2bf' },
  { name: 'Green', value: '#4cb782' },
  { name: 'Yellow', value: '#f2c94c' },
  { name: 'Orange', value: '#e2902b' },
  { name: 'Pink', value: '#f5a8c7' },
  { name: 'Red', value: '#eb5757' },
];

export const LABEL_COLOR_VALUES: string[] = LABEL_COLORS.map((c) => c.value);
