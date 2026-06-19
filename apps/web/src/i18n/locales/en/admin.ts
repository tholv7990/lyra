export default {
  // Page header
  heading: 'Admin',
  subtitle: 'Platform operations',
  notAuthorized: 'You do not have access to this page.',

  // Tabs
  tab: {
    overview: 'Overview',
    users: 'Users',
    platform: 'Platform',
  },

  // Overview
  overviewDesc: 'Platform-wide totals across every workspace.',
  stat: {
    users: 'Users',
    workspaces: 'Workspaces',
    projects: 'Projects',
    pipelines: 'Pipelines',
    prompts: 'Prompts',
    runs: 'Runs',
    chats: 'Chats',
    signups30d: 'New in 30 days',
  },
  recentSignups: 'Recent signups',
  noSignups: 'No signups yet.',

  // Users list
  usersDesc: 'Everyone with an account on this install.',
  searchUsers: 'Search by name or email…',
  noUsersTitle: 'No users',
  noUsersBody: 'No accounts have been created yet.',
  noMatch: 'No users match your search.',
  openUser: 'Open {{name}}',
  joinedOn: 'Joined {{date}}',
  workspaceCount: '{{count}} workspace',
  workspaceCount_other: '{{count}} workspaces',
  backToUsers: 'Users',
  col: {
    email: 'Email',
    name: 'Name',
    joined: 'Joined',
    workspaces: 'Workspaces',
    status: 'Status',
  },
  active: 'Active',
  inactive: 'Inactive',
  prev: 'Prev',
  next: 'Next',
  pagerInfo: 'Page {{page}} of {{totalPages}} · {{total}} total',

  // User detail
  workspaces: 'Workspaces',
  noWorkspaces: 'Not a member of any workspace.',
  usage: 'Usage',
  role: {
    owner: 'Owner',
    member: 'Member',
  },
  deactivate: 'Deactivate',
  reactivate: 'Reactivate',
  deactivateTitle: 'Deactivate user',
  deactivateConfirm: 'Deactivate',
  cantDeactivateSelf: 'You cannot deactivate your own account.',

  // Prompt catalog card (Platform)
  catalogTitle: 'Prompt catalog',
  catalogDesc: 'The shared prompts.chat catalog that powers the Marketplace.',
  catalogCount: 'Prompts in catalog',
  lastSynced: 'Last synced',
  neverSynced: 'Never',
  sync: 'Sync prompts.chat catalog',
  syncing: 'Syncing…',
  imported: 'Imported {{count}} prompt.',
  imported_other: 'Imported {{count}} prompts.',

  // States
  loading: 'Loading…',
  error: 'Something went wrong. Try again.',
} as const;
