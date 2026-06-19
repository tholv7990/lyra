export default {
  // Page heading (sr-only landmark)
  heading: 'Prompt Marketplace',
  subtitle: 'Browse community prompts, let AI find the right one, and add it to your library.',

  // AI filter
  aiPlaceholder: 'Describe what you need…',
  aiRun: 'Find prompts',
  aiRunning: 'Ranking…',
  aiResultsFor: 'AI picks for “{{query}}”',
  aiHint: 'Ranked by relevance',
  browseAll: 'Browse all',
  clear: 'Clear',
  relevance: '{{score}}% match',

  // Browse mode
  searchPlaceholder: 'Search the catalog…',

  // Browse filter popover (Type / Category / Tags)
  filter: 'Filter',
  filterType: 'Type',
  filterCategory: 'Category',
  filterTags: 'Tags',

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
  added: 'Added ✓',
  openSource: 'Source: {{source}}',

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
