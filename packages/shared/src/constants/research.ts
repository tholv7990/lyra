// The 100-point opportunity model (spec §1E). Sums to 100. The single source of
// truth for the scoring sub-dimensions — ScoreKey/SubScores derive from it.
export const WEIGHTS = {
  demandIntent: 15,
  trendDurability: 10,
  problemIntensity: 10,
  whitespace: 12,
  unitEconomics: 18,
  creativePotential: 10,
  channelFit: 7,
  supplyQuality: 8,
  riskCompliance: 5,
  expansionValue: 5,
} as const;

export type ScoreKey = keyof typeof WEIGHTS;
export type SubScores = Record<ScoreKey, number>; // each 0..5 (grounded LLM sub-score)
