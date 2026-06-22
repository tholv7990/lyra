export default {
  title: 'Monitor',
  subtitle: 'Track competitor ads and market activity across platforms.',

  // Stats and status badges
  statNew: 'New today',
  statStopped: 'Stopped today',
  statWatching: 'Watching',
  badgeNew: 'New',
  badgeStopped: 'Stopped',
  badgeOngoing: '{{days}}d',

  // Tabs and sections
  tabChangelog: 'Changelog',
  tabWatchlist: 'Watchlist',
  tabApprovals: 'Approvals',

  // Actions
  approve: 'Approve',
  reject: 'Reject',
  remove: 'Remove',
  discoverCta: 'Discover competitors',

  // Forms and inputs
  discoverPlaceholder: 'Enter competitor keywords or brands…',

  // States
  empty: 'No competitors yet — discover or add one to start monitoring.',
  noKey: 'Monitor credentials not configured. Set your API key in Connections.',

  // Shared
  loading: 'Loading…',
  error: 'Something went wrong. Try again.',
} as const;
