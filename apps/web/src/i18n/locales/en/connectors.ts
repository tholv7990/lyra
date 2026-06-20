export default {
  // Connections
  connectionsTitle: 'Connections',
  connectionsSubtitle:
    'Link the accounts and services your built-in tools use. Stored securely; disconnect anytime.',
  publishing: 'Publishing',
  postizKey: 'Postiz API key',
  update: 'Update',
  save: 'Save',
  connectedChannels: 'Connected channels',
  connectChannel: 'Connect a channel',
  mediaImport: 'Media import',
  cobaltNote:
    'Media import is ready. Configured at the workspace level — no per-account login. Paste a link in Import media to pull video or images.',
  connected: 'connected',
  remove: 'Remove',
  notConnected: 'not connected',
  manageInPostiz: 'Manage channels in Postiz',
  postizKeyHint:
    'Generate this in your Postiz instance (Settings → Public API). Channels are connected inside Postiz, then appear here.',

  // Publish composer
  publishTitle: 'Publish',
  publishSubtitle:
    'Compose once, post to every connected channel. You review before anything goes out.',
  postTo: 'Post to',
  caption: 'Caption',
  media: 'Media',
  addMedia: 'Add media',
  mediaUrlPlaceholder: 'Paste a media URL…',
  reviewNote: 'Review before posting · publishing always requires your click',
  publishBtn: 'Publish to {{count}} channel',
  publishBtn_other: 'Publish to {{count}} channels',
  publishing_state: 'Publishing…',
  results: 'Results',
  posted: 'Posted',
  failed: 'Failed',
  viewPost: 'View post',
  noChannels: 'No channels connected yet — add one in Connections.',

  // Crawler
  importTitle: 'Crawler',
  importSubtitle:
    'Paste a social link to pull the video or images. For content you own or have rights to use.',
  urlPlaceholder: 'Paste a TikTok / Instagram / YouTube / X / Facebook link…',
  fetch: 'Fetch',
  preparingWorkspace: 'Preparing workspace before fetching…',
  resolvingMedia: 'Resolving media from this link…',
  supported: 'Works with TikTok · Instagram · YouTube · X · Facebook',
  resolved: 'Resolved · {{count}} item',
  resolved_other: 'Resolved · {{count}} items',
  download: 'Download',
  downloadAll: 'Download all (.zip)',
  quality: 'Quality',
  audioOnly: 'Audio only',
  downloading: 'Downloading…',
  cookiesActive: 'Login cookies active',
  cookiesUpload: 'Use my login (upload cookies.txt)',
  cookiesRemove: 'Remove',
  cookiesHint: 'For content you own or have rights to. Stored encrypted; used for logged-in or age-restricted videos.',
  tosNote: 'Import content you own or have the rights to use. Subject to each platform\'s terms.',
  nothingResolved: 'Nothing to import from that link.',

  // shared
  loading: 'Loading…',
  error: 'Something went wrong. Try again.',
} as const;
