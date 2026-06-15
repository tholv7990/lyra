import { StepKey, StepMode, Provider } from '../enums';

// step.key -> provider registry. Swapping a model for a step is a one-line
// change here; the api enforces per-step key gating against this map and the
// web reflects the same locked/unlocked state.
export const STEP_PROVIDERS: Record<StepKey, Provider> = {
  [StepKey.Find]: Provider.OpenAI,
  [StepKey.Crawl]: Provider.DeepSeek,
  [StepKey.Brief]: Provider.Anthropic,
  [StepKey.Insight]: Provider.Anthropic,
  [StepKey.Prompts]: Provider.Anthropic,
  [StepKey.Images]: Provider.Image,
  [StepKey.Video]: Provider.Video,
  [StepKey.QA]: Provider.Anthropic,
};

export interface StepDef {
  index: number;
  key: StepKey;
  title: string;
  owner: string;
  mode: StepMode;
  phase: 'source' | 'brain' | 'render' | 'finish';
  promptTemplate: string;
}

export const STEP_DEFS: StepDef[] = [
  {
    index: 0,
    key: StepKey.Find,
    title: 'Find sources',
    owner: 'GPT-5.5 Pro',
    mode: StepMode.Auto,
    phase: 'source',
    promptTemplate:
      'Find the top-performing competitor ads and reference creatives for {product} in the {niche} space.\nReturn 8–10 sources, each with: URL, the hook, format, and why it performs.',
  },
  {
    index: 1,
    key: StepKey.Crawl,
    title: 'Crawl & extract',
    owner: 'DeepSeek',
    mode: StepMode.Auto,
    phase: 'source',
    promptTemplate:
      'Crawl the sources from Step 1.\nExtract: ad copy, hooks, visible specs, price points, and visual patterns.\nOutput structured JSON grouped by source.',
  },
  {
    index: 2,
    key: StepKey.Brief,
    title: 'Brand Brief',
    owner: 'Claude',
    mode: StepMode.Gate,
    phase: 'brain',
    promptTemplate:
      'Paste brand info below — Claude structures it into brand DNA.\n\n• Color story:\n• Product details (variants, specs):\n• Voice / tone:\n• The Quiet Hero arc:\n• Homepage: {homepage}',
  },
  {
    index: 3,
    key: StepKey.Insight,
    title: 'Competitor Insight',
    owner: 'Claude',
    mode: StepMode.Auto,
    phase: 'brain',
    promptTemplate:
      'From the crawled data, identify for {product}:\n• Winning angles + hooks\n• Visual patterns that repeat\n• The gap we can own\n• Tropes to avoid',
  },
  {
    index: 4,
    key: StepKey.Prompts,
    title: 'Direction + Prompts',
    owner: 'Claude',
    mode: StepMode.Gate,
    phase: 'brain',
    promptTemplate:
      'Generate from the brief + insights:\n• 9 image prompts (hero, grip detail, lifestyle ×3, studio ×2, before/after, packaging)\n• 3 UGC scripts (15s, hook-led)\nReview and edit below, then approve to unlock render.',
  },
  {
    index: 5,
    key: StepKey.Images,
    title: 'Images',
    owner: 'cutout · generate · upscale',
    mode: StepMode.Auto,
    phase: 'render',
    promptTemplate:
      'Render stills from the approved prompts.\n• Product shots: edit the REAL product image (keep the trainer accurate)\n• Atmospheric shots: generate fresh, brand-graded\n• Upscale 4×, clean backgrounds',
  },
  {
    index: 6,
    key: StepKey.Video,
    title: 'Video / UGC',
    owner: 'avatars · cinematic · voice',
    mode: StepMode.Auto,
    phase: 'render',
    promptTemplate:
      'Produce from the approved scripts:\n• 3 avatar UGC ads for paid social\n• 1 cinematic b-roll cut for the brand film\n• Voiceover matched to the {product} brand voice',
  },
  {
    index: 7,
    key: StepKey.QA,
    title: 'Assemble + QA',
    owner: 'logo · grade · caption',
    mode: StepMode.Gate,
    phase: 'finish',
    promptTemplate:
      'Final assembly + QA:\n• Apply logo + color grade + captions\n• Check brand fit and product accuracy\nApprove to ship the batch.',
  },
];
