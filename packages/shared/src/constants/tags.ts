// Prompt tags are free-form strings (see Prompt.tags). These bounds and the
// palette are the single source of truth shared by the api (normalization +
// validation) and the web (picker + colored chips).

export const TAG_MAX_LEN = 30; // characters per tag (after trim)
export const TAG_MAX = 20; // tags per prompt

// Deterministic chip colors — a tag is hashed to one of these (tagColor()).
// Linear's `decoration/` palette (pulled from the Linear Design System Figma).
// Brand orange (#FF6B1A) is intentionally excluded; it's reserved for CTAs.
export const TAG_PALETTE: string[] = [
  '#4ea7fc', // blue
  '#00b2bf', // teal
  '#bb87fc', // purple
  '#4cb782', // green
  '#f2c94c', // yellow
  '#f2994a', // orange
  '#eb5757', // red
  '#fa6563', // red-light
  '#978200', // mustard
  '#95a2b3', // grey
];

// A named, user-pickable label colour (Linear's label palette). Used by the
// label picker's "Pick a color" step. Brand orange (#FF6B1A) is intentionally
// excluded — it's reserved for CTAs/active state.
export interface LabelColor {
  name: string;
  value: string; // hex
}

export const LABEL_COLORS: LabelColor[] = [
  { name: 'Grey', value: '#95a2b3' },
  { name: 'Blue', value: '#4ea7fc' },
  { name: 'Purple', value: '#bb87fc' },
  { name: 'Teal', value: '#00b2bf' },
  { name: 'Green', value: '#4cb782' },
  { name: 'Yellow', value: '#f2c94c' },
  { name: 'Orange', value: '#f2994a' },
  { name: 'Red', value: '#eb5757' },
];

export const LABEL_COLOR_VALUES: string[] = LABEL_COLORS.map((c) => c.value);
