// Solid (filled) line icons, 16px — Linear-style. Single colour via currentColor.
import type { SVGProps } from 'react';

const s = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  ...props,
});

// Section/nav icons — stroked outline to match the design system.
const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M2.5 6.5 8 2.2l5.5 4.3v6.3a.7.7 0 0 1-.7.7H3.2a.7.7 0 0 1-.7-.7V6.5Z" />
    <path d="M6.2 13.5V9h3.6v4.5" />
  </svg>
);

export const ProjectsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M2.4 5.2V4a1 1 0 0 1 1-1h2.5l1.2 1.4h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1Z" />
  </svg>
);

export const ComponentsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <rect x="2.6" y="2.6" width="4.4" height="4.4" rx="1" />
    <rect x="9" y="2.6" width="4.4" height="4.4" rx="1" />
    <rect x="2.6" y="9" width="4.4" height="4.4" rx="1" />
    <rect x="9" y="9" width="4.4" height="4.4" rx="1" />
  </svg>
);

export const MembersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <circle cx="6" cy="6" r="2.2" />
    <path d="M2.6 12.4a3.4 3.4 0 0 1 6.8 0M10.4 4.2a2.2 2.2 0 0 1 0 3.6M11 12.4a3.4 3.4 0 0 0-1.6-2.9" />
  </svg>
);

// Single person — the "personal workspace" type marker (vs MembersIcon = team).
export const PersonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <circle cx="8" cy="5.4" r="2.6" />
    <path d="M3 13.4a5 5 0 0 1 10 0" />
  </svg>
);

export const PromptsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M2.6 4.2a1.6 1.6 0 0 1 1.6-1.6h7.6a1.6 1.6 0 0 1 1.6 1.6v5a1.6 1.6 0 0 1-1.6 1.6H6.4l-3 2.4v-2.4H4.2A1.6 1.6 0 0 1 2.6 9.2Z" />
  </svg>
);

// `</>` prompt/template glyph — the Prompts home tile (distinct from the Chats bubble).
export const PromptGlyphIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3.4 2.2 8 4 12.6M12 3.4 13.8 8 12 12.6M9.4 4.2 6.6 11.8" />
  </svg>
);

// Storefront — awning over a shop front — the Prompt Marketplace section.
export const MarketplaceIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M2.6 6.3 3.4 3a.8.8 0 0 1 .78-.6h7.64a.8.8 0 0 1 .78.6l.8 3.3M2.6 6.3a1.7 1.7 0 0 0 3.13.9 1.7 1.7 0 0 0 2.94 0 1.7 1.7 0 0 0 2.94 0 1.7 1.7 0 0 0 3.13-.9M3.4 8.1v5a.7.7 0 0 0 .7.7h7.8a.7.7 0 0 0 .7-.7v-5" />
  </svg>
);

// Chat bubble — the Chats (conversations) launcher.
export const ChatsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M2.6 4a1.4 1.4 0 0 1 1.4-1.4h8a1.4 1.4 0 0 1 1.4 1.4v5a1.4 1.4 0 0 1-1.4 1.4H6.6l-2.8 2.2V10.4H4A1.4 1.4 0 0 1 2.6 9Z" />
  </svg>
);

export const PipelinesIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <circle cx="4" cy="4" r="1.7" />
    <circle cx="4" cy="12" r="1.7" />
    <circle cx="12" cy="8" r="1.7" />
    <path d="M5.7 4H8a2 2 0 0 1 2 2v.3M5.7 12H8a2 2 0 0 0 2-2v-.3" />
  </svg>
);

export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.8v1.8M8 12.4v1.8M14.2 8h-1.8M3.6 8H1.8M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3M12.4 12.4l-1.3-1.3M4.9 4.9 3.6 3.6" />
  </svg>
);

// Key — the Provider keys home tile (BYO encrypted keys); bow top-left, toothed shaft.
export const KeyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.6" cy="5.6" r="3" />
    <path d="m7.7 7.7 5 5M11 11.3l1.4-1.4M9.4 9.7 11 8.1" />
  </svg>
);

export const ChevronIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s({ width: 14, height: 14, ...p })} className="ws-chevron">
    <path d="M3.3 5.55a1 1 0 0 1 1.4 0L8 8.84l3.3-3.29a1 1 0 1 1 1.4 1.42l-4 3.98a1 1 0 0 1-1.4 0l-4-3.98a1 1 0 0 1 0-1.42Z" />
  </svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s({ width: 14, height: 14, ...p })} className="check">
    <path d="M6.16 11.1 3.3 8.24a.9.9 0 0 1 1.27-1.27l2.18 2.18 4.65-4.66a.9.9 0 1 1 1.28 1.28l-5.3 5.3a.9.9 0 0 1-1.27 0Z" />
  </svg>
);

export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <rect
      x="5.4"
      y="5.4"
      width="8.6"
      height="8.6"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M3.5 10.5A1.5 1.5 0 0 1 2 9V3.5A1.5 1.5 0 0 1 3.5 2H9a1.5 1.5 0 0 1 1.5 1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Box / package — the workspace Products section.
export const ProductsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" />
    <path d="M8 2v12M2 5l6 3 6-3" />
  </svg>
);

// Two 4-point sparkles — the "AI" affordance.
export const SparkleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M7 1.6c.35 2.85 1.45 3.95 4.3 4.3-2.85.35-3.95 1.45-4.3 4.3-.35-2.85-1.45-3.95-4.3-4.3 2.85-.35 3.95-1.45 4.3-4.3Z" />
    <path d="M12.2 9.1c.18 1.45.74 2.02 2.2 2.2-1.46.18-2.02.74-2.2 2.2-.18-1.46-.74-2.02-2.2-2.2 1.46-.18 2.02-.75 2.2-2.2Z" />
  </svg>
);

// Filled play triangle — the run/test-run action.
export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M4.5 3.2 12 8l-7.5 4.8Z" />
  </svg>
);

// Solid X (the plus glyph rotated 45°) — used for the cancel/discard action.
export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path
      transform="rotate(45 8 8)"
      d="M8 2.4a.95.95 0 0 1 .95.95V7.05h3.7a.95.95 0 0 1 0 1.9H8.95v3.7a.95.95 0 0 1-1.9 0V8.95H3.35a.95.95 0 0 1 0-1.9h3.7V3.35A.95.95 0 0 1 8 2.4Z"
    />
  </svg>
);

// Solid funnel — "filter".
export const FilterIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M2.2 3.5h11.6a.7.7 0 0 1 .53 1.16L9.8 9.3v3a.7.7 0 0 1-1.02.62l-1.9-1.02A.7.7 0 0 1 6.5 11.3V9.3L1.67 4.66A.7.7 0 0 1 2.2 3.5Z" />
  </svg>
);

// Solid eye — "view full prompt details".
export const EyeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8 3.4c-3.6 0-6.5 2.7-7.5 4.3a.6.6 0 0 0 0 .6C1.5 9.9 4.4 12.6 8 12.6s6.5-2.7 7.5-4.3a.6.6 0 0 0 0-.6C14.5 6.1 11.6 3.4 8 3.4Zm0 7.2a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
    <circle cx="8" cy="8" r="1.25" fill="#fff" />
  </svg>
);

// Solid list — the "history" affordance (open the saved-tests list).
export const ListIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <rect x="2" y="3.2" width="3" height="3" rx="0.8" />
    <rect x="6.6" y="3.7" width="7.4" height="2" rx="1" />
    <rect x="2" y="8.4" width="3" height="3" rx="0.8" />
    <rect x="6.6" y="8.9" width="7.4" height="2" rx="1" />
  </svg>
);

// Solid pencil — the mobile "edit name" affordance (tap to rename in place).
export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M10.94 1.96a1.7 1.7 0 0 1 2.4 0l.7.7a1.7 1.7 0 0 1 0 2.4l-.86.86-3.1-3.1.86-.86Z" />
    <path d="M9.02 3.74l3.1 3.1-6.0 6.0a1 1 0 0 1-.45.26l-3.06.83a.55.55 0 0 1-.68-.68l.83-3.06a1 1 0 0 1 .26-.45l6.0-6.0Z" />
  </svg>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M6.5 1.6a1 1 0 0 0-1 1V3H2.9a.75.75 0 0 0 0 1.5h10.2A.75.75 0 0 0 13.1 3H10.5v-.4a1 1 0 0 0-1-1h-3Zm.5 1.4h2V3H7v0Z" />
    <path d="M3.9 5.6h8.2l-.52 7.03A1.5 1.5 0 0 1 10.08 14H5.92a1.5 1.5 0 0 1-1.5-1.37L3.9 5.6Z" />
  </svg>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8 2.4a.95.95 0 0 1 .95.95V7.05h3.7a.95.95 0 0 1 0 1.9H8.95v3.7a.95.95 0 0 1-1.9 0V8.95H3.35a.95.95 0 0 1 0-1.9h3.7V3.35A.95.95 0 0 1 8 2.4Z" />
  </svg>
);

export const RefreshIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M3.05 8a4.95 4.95 0 0 1 8.4-3.55l.78-.78A.7.7 0 0 1 13.43 4.16V7.1a.7.7 0 0 1-.7.7H9.8a.7.7 0 0 1-.5-1.2l1.02-1.02A3.15 3.15 0 0 0 4.65 8a.8.8 0 0 1-1.6 0Z" />
    <path d="M12.95 8a4.95 4.95 0 0 1-8.4 3.55l-.78.78A.7.7 0 0 1 2.57 11.84V8.9a.7.7 0 0 1 .7-.7H6.2a.7.7 0 0 1 .5 1.2l-1.02 1.02A3.15 3.15 0 0 0 11.35 8a.8.8 0 0 1 1.6 0Z" />
  </svg>
);

export const LogoutIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M3.5 2.5h4a1.5 1.5 0 0 1 1.5 1.5v1.2a.8.8 0 0 1-1.6 0V4.1H4v7.8h3.4v-1.1a.8.8 0 0 1 1.6 0V12a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 2 12V4a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M11.06 5.64 13.7 7.4a.7.7 0 0 1 0 1.2l-2.64 1.76a.7.7 0 0 1-1.09-.58V8.8H7.4a.8.8 0 0 1 0-1.6h2.57V6.22a.7.7 0 0 1 1.09-.58Z" />
  </svg>
);

// Paper plane — Publish (post to channels).
export const PublishIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M13.6 2.4 7.2 8.8M13.6 2.4l-4 11.2-2.4-4.8-4.8-2.4Z" />
  </svg>
);

// Down-arrow into a tray — Crawler / import media (download in).
export const ImportIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M8 2.4v7M5 6.6 8 9.6l3-3M2.8 10.4v1.8a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-1.8" />
  </svg>
);

// Shield with a centred gear cut-out — Admin (platform operations).
export const AdminIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.62 1.46a1 1 0 0 1 .76 0l4.6 1.9a1 1 0 0 1 .62.92v3.06c0 3.2-1.96 5.5-5.27 6.78a1 1 0 0 1-.72 0C4.3 12.84 2.4 10.54 2.4 7.34V4.28a1 1 0 0 1 .62-.92l4.6-1.9ZM8 5.55a2.45 2.45 0 1 0 0 4.9 2.45 2.45 0 0 0 0-4.9Zm0 1.6a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7Z"
    />
  </svg>
);

// ── Prompt output-type glyphs (PromptType: text/image/audio/video) ──
// Hand-authored, 16 viewBox, currentColor so a token colour can tint them.

// Lines of text on a page — the Text output type.
export const TextTypeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M3.6 1.8h5.2a1 1 0 0 1 .71.3l2.7 2.7a1 1 0 0 1 .29.71V13a1.2 1.2 0 0 1-1.2 1.2H3.6A1.2 1.2 0 0 1 2.4 13V3A1.2 1.2 0 0 1 3.6 1.8Z" />
    <rect x="4.4" y="7" width="6.2" height="1.2" rx="0.6" fill="#fff" />
    <rect x="4.4" y="9.4" width="6.2" height="1.2" rx="0.6" fill="#fff" />
    <rect x="4.4" y="11.8" width="4" height="1.2" rx="0.6" fill="#fff" />
  </svg>
);

// Framed picture with a sun + hill — the Image output type.
export const ImageTypeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <rect x="2" y="3" width="12" height="10" rx="1.6" />
    <circle cx="5.5" cy="6.4" r="1.2" fill="#fff" />
    <path d="M3 12.4 6.6 8.4l2.1 2.2 2.2-2.6L13 11v1.4a.6.6 0 0 1-.6.6H3.6a.6.6 0 0 1-.6-.6Z" fill="#fff" />
  </svg>
);

// Sound wave bars — the Audio output type.
export const AudioTypeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <rect x="2.2" y="6.6" width="1.7" height="2.8" rx="0.85" />
    <rect x="5" y="4.4" width="1.7" height="7.2" rx="0.85" />
    <rect x="7.8" y="2.2" width="1.7" height="11.6" rx="0.85" />
    <rect x="10.6" y="4.9" width="1.7" height="6.2" rx="0.85" />
    <rect x="13.4" y="6.6" width="1.4" height="2.8" rx="0.7" />
  </svg>
);

// Play triangle in a rounded frame — the Video output type.
export const VideoTypeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <rect x="2" y="3" width="12" height="10" rx="2.2" />
    <path d="M6.6 5.7 10.6 8 6.6 10.3Z" fill="#fff" />
  </svg>
);

// Document with a folded corner — the File output type (pdf/doc/csv/xlsx…).
export const FileTypeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M4 1.8h4.5L12.2 5.5V13a1.2 1.2 0 0 1-1.2 1.2H4A1.2 1.2 0 0 1 2.8 13V3A1.2 1.2 0 0 1 4 1.8Z" />
    <path d="M8.5 2v2.7a.8.8 0 0 0 .8.8h2.6" fill="none" stroke="#fff" strokeWidth="1" />
    <rect x="4.6" y="8.4" width="5" height="1.1" rx="0.55" fill="#fff" />
    <rect x="4.6" y="10.6" width="3.4" height="1.1" rx="0.55" fill="#fff" />
  </svg>
);

export const BellIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8 1.4a3.9 3.9 0 0 0-3.9 3.9v2.05c0 .5-.2.98-.55 1.33l-.62.62A1.05 1.05 0 0 0 3.68 11.1h8.64a1.05 1.05 0 0 0 .74-1.79l-.62-.62a1.88 1.88 0 0 1-.55-1.33V5.3A3.9 3.9 0 0 0 8 1.4Z" />
    <path d="M6.35 12.1a1.7 1.7 0 0 0 3.3 0H6.35Z" />
  </svg>
);

// Two interlocking links — Connections.
export const ConnectionsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <path d="M6.6 9.4 9.4 6.6M7 4.6l.9-.9a2.5 2.5 0 0 1 3.5 3.5l-.9.9M9 11.4l-.9.9a2.5 2.5 0 0 1-3.5-3.5l.9-.9" />
  </svg>
);

// Magnifying glass over a chart/dashboard — Monitor (competitors & ads).
export const MonitorIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon" {...stroke}>
    <circle cx="5.2" cy="4.6" r="2.8" />
    <path d="M7.4 6.8 10.8 10.2" />
    <rect x="2" y="7.6" width="4" height="5.4" rx="0.6" />
    <rect x="7" y="5.6" width="4" height="7.4" rx="0.6" />
  </svg>
);

// Generic fingerprint (nested arcs) — denotes a browser-automation (GoLogin)
// connection. A neutral placeholder, not any brand's logo.
// Magnifier — the search-box glyph for the library list toolbars.
export const SearchGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <circle cx="7" cy="7" r="4.4" />
    <path d="m10.4 10.4 3 3" />
  </svg>
);
