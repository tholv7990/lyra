export default {
  // status
  statusDraft: 'Draft',
  statusPublic: 'Public',

  // Prompts list — heading
  heading: 'Prompts',
  subtitle:
    'Your workspace library of reusable, on-brand prompts. Open one in chat or wire it into a pipeline.',

  // Prompts list — toolbar / filters
  searchPlaceholder: 'Search prompts…',
  filter: 'Filter',
  filterStatus: 'Status',
  filterType: 'Type',
  filterTags: 'Tags',
  filterProvider: 'Provider',
  filterCreatedBy: 'Created by',
  noPromptTags: 'No prompt tags',
  newPrompt: 'New prompt',

  // Prompts list — type pills, sort, result meta
  allTypes: 'All',
  sortLabel: 'Sort',
  sortUpdated: 'Recently updated',
  sortAz: 'A–Z',
  showingRange: 'Showing {{start}}–{{end}} of {{total}} prompts',
  savedCount_one: '{{count}} saved',
  savedCount_other: '{{count}} saved',
  edit: 'Edit',
  editNamed: 'Edit {{title}}',
  next: 'Next',

  // Prompts list — states
  loadingPrompts: 'Loading prompts…',
  emptyTitle: 'Build your prompt library',
  emptyBody: 'Save reusable prompts, tag them, and use them as steps in your pipelines.',
  emptyCta: 'Create your first prompt',
  noMatch: 'No prompts match these filters.',

  // Prompts list — rows
  clickToRename: 'Click to rename',
  viewFullPrompt: 'View full prompt',
  viewFullPromptFor: 'View full prompt for {{title}}',
  toggleStatus: 'Toggle Draft / Public',
  openInChat: 'Open in chat',
  openInChatNamed: 'Open {{title}} in chat',
  savedResults: 'Saved results',
  savedResultsEmpty: 'No saved answers yet — save a good response from chat to keep it here.',
  openSourceChat: 'Open the chat this came from',
  deleteResult: 'Remove this saved answer',
  saveAnswer: 'Save answer',
  saveAnswerHint: 'Save this answer to the prompt',
  answerSaved: 'Saved ✓',
  deletePrompt: 'Delete prompt',
  deletePromptNamed: 'Delete {{title}}',
  updatedBy: 'Updated by {{name}}',

  // breadcrumb origin label
  breadcrumb: 'Prompts',

  // pager
  prev: 'Prev',
  pagerInfo: 'Page {{page}} of {{totalPages}} · {{total}} total',

  // delete dialog
  deleteTitle: 'Delete prompt?',
  deleteRemoved: 'will be removed from the library. This can’t be undone.',
  deleteUsageWarn_one: 'Used by {{count}} pipeline — those steps will be left empty.',
  deleteUsageWarn_other: 'Used by {{count}} pipelines — those steps will be left empty.',

  // errors
  errUpdate: 'Could not update prompt',
  errDelete: 'Could not delete prompt',
  errLoad: 'Could not load prompt',
  errSave: 'Could not save prompt',
  errUpload: 'Could not upload {{name}}',
  errFileType: '{{name}}: file type not allowed',
  errFileSize: '{{name}}: exceeds 25 MB',

  // Output type — metadata badge + filter (PromptType: text/image/audio/video)
  typeLabel: 'Type',
  type: {
    text: 'Text',
    image: 'Image',
    audio: 'Audio',
    video: 'Video',
    file: 'File',
  },

  // PromptEditor
  newTitle: 'New',
  editName: 'Edit name',
  untitled: 'Untitled prompt',
  promptTitlePlaceholder: 'Prompt title',
  titleRequired: 'Add a title to save your prompt.',
  saveChanges: 'Save changes',
  createPrompt: 'Create prompt',
  savePrompt: 'Save prompt',
  labelsPlural: 'Labels',
  variablesDetected: 'Variables detected',
  label: 'Label',
  status: 'Status',
  publicHint: 'Public prompts can be reused across the workspace',
  publicLabel: 'Public',
  writeHeading: 'Write your prompt',
  writeHint: 'Type your prompt in the box below — wrap variables in braces.',
  variables: 'Variables',
  variablesPipeline: 'and in a pipeline,',
  variablesPrevStep: 'previous step',
  variablesOr: 'or',
  variablesAnyStep: 'any earlier step',
  addPrompt: 'Add prompt…',
  saveShortcut: 'to save',
  charCount: '{{chars}} chars',
  onlyEditOwn: 'You can only edit prompts you created.',
  unsavedTitle: 'Save changes?',
  unsavedBody: 'You have unsaved changes. If you leave, they’ll be lost.',
  discardLeave: 'Discard & leave',

  // PromptDetails
  editPrompt: 'Edit prompt',
  noContent: 'No content.',
  createdBy: 'Created by {{name}}',

  // SaveAsPromptModal
  saveAsPrompt: 'Save as prompt',
  title: 'Title',
  titlePlaceholder: 'e.g. Hero headline generator',
  prompt: 'Prompt',
  saveToLibrary: 'Save to library',

  // PromptPicker
  noTagsYet: 'No tags yet.',
  filterByTags: 'Filter by tags',
  noPublicPrompts: 'No public prompts yet — publish a prompt to use it in a step.',
  noMatchFilters: 'No prompts match your filters.',
} as const;
