export default {
  // Heading
  subtitle:
    'Chain prompts into a repeatable flow — each step binds a prompt to a model and runs automatically or pauses at a gate.',
  showingRange: 'Showing {{start}}–{{end}} of {{total}} pipelines',

  // Toolbar / filters
  searchPlaceholder: 'Search pipelines…',
  filter: '+ Filter',
  filterLabel: 'Filter',
  filterAiOnly: 'AI-built only',
  filterGate: 'Has a gate',
  gateHint: 'Gate — pauses for approval',
  tags: 'Tags',
  noTags: 'No pipeline tags',
  createdBy: 'Created by',
  newPipeline: 'New pipeline',
  open: 'Open',
  next: 'Next',
  duplicateNamed: 'Duplicate {{name}}',
  duplicateError: 'Could not duplicate pipeline',
  copyName: '{{name}} (copy)',

  // AI builder
  buildWithAi: 'Build with AI',
  buildWithAiTitle: 'Build a pipeline with AI',
  buildWithAiHint:
    'Describe what this pipeline should do — AI designs it from your prompt library. You can edit it before saving.',
  goalPlaceholder: 'e.g. Crawl a store, write a creative brief, then generate branded images',
  generate: 'Generate',
  generating: 'Generating…',
  generateError: 'Could not generate a pipeline',
  aiBuilt: 'AI-built',
  needsPrompt: 'Needs a prompt',

  // AI edit (revise an existing pipeline)
  editWithAi: 'Edit with AI',
  editWithAiTitle: 'Edit this pipeline with AI',
  editWithAiHint:
    'Describe the change — AI revises the whole pipeline from your prompt library. Review it before saving.',
  editGoalPlaceholder: 'e.g. Add an image-generation step after branding; make step 2 a gate',
  revise: 'Revise',
  applyToBuilder: 'Apply to builder',
  send: 'Send',
  askPlaceholder: 'Describe the pipeline, or reply to refine it…',

  // List states
  loading: 'Loading pipelines…',
  noMatch: 'No pipelines match your search.',
  emptyTitle: 'Build your first pipeline',
  emptyBody:
    'Chain prompts into a flow — each step runs a prompt on a model you pick, feeding its output to the next.',

  // Rows
  clickToRename: 'Click to rename',
  steps_one: '{{count}} step',
  steps_other: '{{count}} steps',
  createdByName: 'Created by {{name}}',
  openPipeline: 'Open pipeline',
  openNamed: 'Open {{name}}',
  deletePipeline: 'Delete pipeline',
  deleteNamed: 'Delete {{name}}',

  // Pager
  prev: 'Prev',
  pageInfo: 'Page {{page}} of {{totalPages}} · {{total}} total',

  // Delete confirm
  deleteConfirmTitle: 'Delete pipeline?',
  deleteConfirmBefore: '',
  deleteConfirmAfter: ' will be removed. Projects using it lose access. This can’t be undone.',

  // Errors
  updateError: 'Could not update pipeline',
  deleteError: 'Could not delete pipeline',
  loadError: 'Could not load pipeline',
  createError: 'Could not create pipeline',
  saveError: 'Could not save pipeline',
  startTestError: 'Could not start test',
  pickPromptError: 'Pick a prompt for this step.',

  // Builder header / actions
  breadcrumbNew: 'New',
  namePlaceholder: 'Pipeline name',
  notePlaceholder: 'Note (optional) — available to prompts as {note}',
  defaultStepName: 'Step',
  createTitle: 'Create pipeline',
  saveChanges: 'Save changes',
  testHint: 'Runs with no project · {note} fills from the note',
  test: 'Test',
  testRunLabel: 'Test run',
  testing: 'Testing…',

  // Test run bar
  backToEditing: 'Back to editing',
  testRun: 'Test run',

  // No prompts notice
  noPromptsBefore: 'No prompts yet — ',
  noPromptsLink: 'create a prompt',
  noPromptsAfter: ' first to add steps.',

  // Flow
  flowStart: 'Start',
  flowEnd: 'End',
  loadingCanvas: 'Loading canvas…',

  // Step drawer
  addStep: 'Add Step',
  editStep: 'Edit Step',
  addStepTitle: 'Add step',
  saveStepTitle: 'Save step',

  // Fan-out
  fanOut: 'Fan out',
  fanOutDesc: '— run this step once per item in a collection, in parallel',
  collectionName: 'Collection name',
  collectionPlaceholder: 'e.g. images',
  fanOutHelpBefore: 'Each item fills ',
  fanOutHelpMid: ' (and ',
  fanOutHelpAfter: ') in the prompt. You enter the items when you run.',

  // Condition
  condition: 'Condition',
  conditionDesc: '— run this step only when a variable matches (else skip it)',
  when: 'when',
  variablePlaceholder: 'variable',
  valuePlaceholder: 'value',
  condOpExists: 'is set',
  condOpEmpty: 'is empty',
  condOpEq: 'equals',
  condOpNe: 'is not',
  condOpContains: 'contains',
  condOpGt: 'greater than',
  condOpLt: 'less than',
} as const;
