export default {
  // Page heading
  heading: 'Prompt Marketplace',
  subtitle:
    'A community catalog of ready-made prompts. Find one, then adopt it into your workspace library in a click.',

  // Category pills + sort + result meta
  allCategories: 'All',
  sortLabel: 'Sort',
  sortNewest: 'Newest',
  sortAz: 'A–Z',
  showingRange: 'Showing {{start}}–{{end}} of {{total}} prompts',

  // AI filter
  aiSearch: 'AI',
  aiRank: 'AI rank',
  aiBannerTitle: 'AI rank is on.',
  aiBannerBody: 'Cards are scored 0–100 against your search and sorted by best match.',
  match: 'Match',
  aiSearchHint: 'Find matching prompts with AI (uses the search text)',
  aiRunning: 'Ranking…',
  aiResultsFor: 'AI picks for “{{query}}”',
  aiHint: 'Ranked by relevance',
  browseAll: 'Browse all',
  clear: 'Clear',
  relevance: '{{score}}% match',

  // Browse mode
  searchPlaceholder: 'Search the catalog…',
  aiPlaceholder: 'Describe what you need — AI ranks the catalog…',

  // Browse filter popover (Type / For developers)
  filter: 'Filter',
  filterType: 'Type',
  filterCategory: 'Category',
  filterTags: 'Tags',
  filterForDevs: 'For developers',
  preview: 'Preview',
  adopt: 'Adopt',
  done: 'Done',
  fillsVariables: 'Fills these variables',
  addedView: 'Added — view in library',

  // Card
  by: 'by {{name}}',
  byUnknown: 'Community',
  devBadge: 'Dev',
  typeText: 'Text',
  typeStructured: 'Structured',
  variables: 'Variables',
  view: 'View prompt',
  copy: 'Copy prompt',
  copied: 'Copied ✓',
  copiedToast: 'Copied “{{title}}” to your clipboard.',
  openInChat: 'Open in chat',
  add: 'Add to my library',
  adding: 'Adding…',
  confirmEmailToAdd: 'Confirm your email to add',
  added: 'Added ✓',
  openSource: 'Source: {{source}}',

  // Adopt confirmation
  confirmAddTitle: 'Add to your library?',
  confirmAddBody: 'This copies “{{title}}” into your workspace prompts as an editable draft.',

  // States
  loading: 'Loading catalog…',
  emptyTitle: 'Nothing in the catalog yet',
  emptyBody: 'Once community prompts are imported, they’ll show up here to browse and adopt.',
  noMatch: 'No prompts match your search.',
  noRanked: 'The AI filter found no strong matches. Try a different description.',
  error: 'Something went wrong. Try again.',
  errRank: 'Could not rank the catalog. Try again.',
  errAdopt: 'Could not add this prompt to your library.',
  adoptedToast: 'Added “{{title}}” to your library.',

  // Refresh / sync (admin)
  refresh: 'Refresh catalog',
  refreshing: 'Refreshing…',
  refreshed: 'Imported {{count}} prompt.',
  refreshed_other: 'Imported {{count}} prompts.',

  // pager
  prev: 'Prev',
  next: 'Next',
  pagerInfo: 'Page {{page}} of {{totalPages}} · {{total}} total',
} as const;
