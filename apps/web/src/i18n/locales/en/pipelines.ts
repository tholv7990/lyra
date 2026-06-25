export default {
  // Heading
  subtitle:
    'Chain prompts into a repeatable flow — each step binds a prompt to a model and runs automatically or pauses at a gate.',
  showingRange: 'Showing {{start}}–{{end}} of {{total}} flows',

  // Toolbar / filters
  searchPlaceholder: 'Search flows…',
  filter: '+ Filter',
  filterLabel: 'Filter',
  filterAiOnly: 'AI-built only',
  filterGate: 'Has a gate',
  gateHint: 'Gate — pauses for approval',
  tags: 'Tags',
  noTags: 'No flow tags',
  createdBy: 'Created by',
  newPipeline: 'New flow',
  createResearchPipeline: 'Create research flow',
  open: 'Open',
  next: 'Next',
  duplicateNamed: 'Duplicate {{name}}',
  duplicateError: 'Could not duplicate flow',
  copyName: '{{name}} (copy)',

  // AI builder
  buildWithAi: 'Build with AI',
  buildWithAiTitle: 'Build a flow with AI',
  buildWithAiHint:
    'Describe what this flow should do — AI designs it from your prompt library. You can edit it before saving.',
  goalPlaceholder: 'e.g. Crawl a store, write a creative brief, then generate branded images',
  generate: 'Generate',
  generating: 'Generating…',
  generateError: 'Could not generate a flow',
  aiBuilt: 'AI-built',
  needsPrompt: 'Needs a prompt',

  // AI edit (revise an existing pipeline)
  editWithAi: 'Edit with AI',
  builderLabel: 'Builder',
  aiBuilder: 'AI builder',
  editWithAiTitle: 'Edit this flow with AI',
  editWithAiHint:
    'Describe the change — AI revises the whole flow from your prompt library. Review it before saving.',
  editGoalPlaceholder: 'e.g. Add an image-generation step after branding; make step 2 a gate',
  revise: 'Revise',
  applyToBuilder: 'Apply to builder',
  send: 'Send',
  askPlaceholder: 'Describe the flow, or reply to refine it…',

  // List states
  loading: 'Loading flows…',
  noMatch: 'No flows match your search.',
  emptyTitle: 'Build your first flow',
  emptyBody:
    'Chain prompts into a flow — each step runs a prompt on a model you pick, feeding its output to the next.',

  // Rows
  clickToRename: 'Click to rename',
  steps_one: '{{count}} step',
  steps_other: '{{count}} steps',
  createdByName: 'Created by {{name}}',
  openPipeline: 'Open flow',
  openNamed: 'Open {{name}}',
  deletePipeline: 'Delete flow',
  deleteNamed: 'Delete {{name}}',

  // Pager
  prev: 'Prev',
  pageInfo: 'Page {{page}} of {{totalPages}} · {{total}} total',

  // Delete confirm
  deleteConfirmTitle: 'Delete flow?',
  deleteConfirmBefore: '',
  deleteConfirmAfter: ' will be removed. Projects using it lose access. This can’t be undone.',

  // Duplicate confirm
  duplicateConfirmTitle: 'Duplicate flow?',
  duplicateConfirmBefore: 'A copy of ',
  duplicateConfirmAfter: ' will be created as a new flow you can edit.',

  // Errors
  updateError: 'Could not update flow',
  deleteError: 'Could not delete flow',
  loadError: 'Could not load flow',
  createError: 'Could not create flow',
  saveError: 'Could not save flow',
  startTestError: 'Could not start test',
  pickPromptError: 'Pick a prompt for this step.',

  // Builder header / actions
  breadcrumbNew: 'New',
  namePlaceholder: 'Flow name',
  notePlaceholder: 'Note (optional) — available to prompts as {note}',
  defaultStepName: 'Step',
  createTitle: 'Create flow',
  saveChanges: 'Save changes',
  testHint: 'Runs with no project · {note} fills from the note',
  test: 'Test',
  testRunLabel: 'Test run',
  testing: 'Testing…',
  runLabel: 'Run',
  running: 'Running…',

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
  addPromptStep: 'Prompt step',
  addActionStep: 'Action',
  actionBrand: 'Brand',
  brandImageSource: 'Brands the image from the previous step ({input}).',
  brandPosition: 'Logo position',
  brandSize: 'Logo size',
  brandSize_sm: 'S',
  brandSize_md: 'M',
  brandSize_lg: 'L',

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
  overrideLabel: 'Prompt override (run-time edit)',
  customizePrompt: 'Customize prompt',
  composerPlaceholder: "Customize this step's prompt…",
  // Auto-QA toggle in step drawer
  qaToggleLabel: 'QA generated media',
  qaToggleHint: 'After the step produces an image, run a technical quality check and pause for review if issues are found.',
} as const;
