// Prompt media (file attachments). The allow-list mirrors what ChatGPT and
// Claude accept; shared so the api (validation) and web (picker + accept attr)
// agree on one source of truth. Files are stored by the api and referenced by
// PromptMedia.url; categories are derived from the MIME type (mediaTypeForMime).

export const MEDIA_MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file

export const MEDIA_ALLOWED_MIME: string[] = [
  // images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/rtf',
  'text/rtf',
  // data / code
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  // audio
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  // video
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

// Extension allow-list — a fallback when a browser sends a blank/odd MIME, and
// the value for the file picker's `accept` attribute.
export const MEDIA_ALLOWED_EXT: string[] = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.md', '.csv', '.rtf', '.json', '.zip',
  '.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.webm', '.mov',
];

export const MEDIA_ACCEPT = MEDIA_ALLOWED_EXT.join(',');
