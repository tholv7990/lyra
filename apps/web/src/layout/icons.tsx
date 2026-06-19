// Solid (filled) line icons, 16px — Linear-style. Single colour via currentColor.
import type { SVGProps } from 'react';

const s = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  ...props,
});

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8.66 1.78a1 1 0 0 0-1.32 0L1.84 6.6A1.5 1.5 0 0 0 1.33 7.73V13A1.5 1.5 0 0 0 2.83 14.5H5.5a.5.5 0 0 0 .5-.5v-3.1a2 2 0 0 1 4 0V14a.5.5 0 0 0 .5.5h2.67A1.5 1.5 0 0 0 14.67 13V7.73a1.5 1.5 0 0 0-.51-1.13L8.66 1.78Z" />
  </svg>
);

export const ProjectsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M2 4.6A1.6 1.6 0 0 1 3.6 3h2.5a1.6 1.6 0 0 1 1.13.47L8 4.25h4.4A1.6 1.6 0 0 1 14 5.85v5.55A1.6 1.6 0 0 1 12.4 13H3.6A1.6 1.6 0 0 1 2 11.4V4.6Z" />
  </svg>
);

export const MembersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <circle cx="5.6" cy="5.5" r="2.4" />
    <circle cx="11" cy="6.1" r="1.9" />
    <path d="M1.3 12.7c0-2.27 1.93-3.7 4.3-3.7 1.3 0 2.45.43 3.2 1.18a.6.6 0 0 1 .03.83 4.7 4.7 0 0 0-.93 1.94.6.6 0 0 1-.58.45H1.9a.6.6 0 0 1-.6-.6v-.1Z" />
    <path d="M11 9.3c2 0 3.5 1.28 3.5 3.13a.57.57 0 0 1-.57.57h-3.1a.5.5 0 0 1-.49-.42 5.6 5.6 0 0 0-.97-2.36.5.5 0 0 1 .2-.74A4 4 0 0 1 11 9.3Z" />
  </svg>
);

// Single person — the "personal workspace" type marker (vs MembersIcon = team).
export const PersonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <circle cx="8" cy="5" r="2.7" />
    <path d="M2.6 13a.6.6 0 0 1-.6-.62C2.1 9.9 4.6 8.4 8 8.4s5.9 1.5 6 3.98a.6.6 0 0 1-.6.62H2.6Z" />
  </svg>
);

export const PromptsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M4 2.6h8A2 2 0 0 1 14 4.6v4a2 2 0 0 1-2 2H7.1l-3 2.46A.6.6 0 0 1 3.1 12.6V10.5A2 2 0 0 1 2 8.6v-4A2 2 0 0 1 4 2.6Z" />
  </svg>
);

// Storefront — awning over a shop front — the Prompt Marketplace section.
export const MarketplaceIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M2.6 2.6h10.8a1 1 0 0 1 .95.68l.6 1.8a2 2 0 0 1-1.9 2.64 2 2 0 0 1-1.6-.8 2 2 0 0 1-3.2 0 2 2 0 0 1-3.2 0 2 2 0 0 1-1.6.8A2 2 0 0 1 1.55 5.08l.6-1.8a1 1 0 0 1 .95-.68Z" />
    <path d="M3 8.4a3 3 0 0 0 2.4-.6 3 3 0 0 0 1.6.74V11h2V8.54a3 3 0 0 0 1.6-.74A3 3 0 0 0 13 8.4v4.1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.4Zm6 4.1v-1.6a1 1 0 0 0-1-1H8v2.6h1Z" />
  </svg>
);

// Chat bubble with a reply tail + dots — the Chats (conversations) section.
export const ChatsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M3 4.4h10A1.6 1.6 0 0 1 14.6 6v4A1.6 1.6 0 0 1 13 11.6H7.3l-2.9 2.3A.55.55 0 0 1 3.5 13.5V11.6A1.6 1.6 0 0 1 1.4 10V6A1.6 1.6 0 0 1 3 4.4Z" />
    <circle cx="5.4" cy="8" r="0.95" fill="#fff" />
    <circle cx="8" cy="8" r="0.95" fill="#fff" />
    <circle cx="10.6" cy="8" r="0.95" fill="#fff" />
  </svg>
);

export const PipelinesIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path
      d="M5.6 4H9a1.5 1.5 0 0 1 1.5 1.5v1M5.6 12H9a1.5 1.5 0 0 0 1.5-1.5v-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <circle cx="4" cy="4" r="2.1" />
    <circle cx="4" cy="12" r="2.1" />
    <circle cx="12" cy="8" r="2.1" />
  </svg>
);

export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <g>
      <rect x="7" y="0.7" width="2" height="3" rx="0.6" />
      <rect x="7" y="12.3" width="2" height="3" rx="0.6" />
      <rect x="0.7" y="7" width="3" height="2" rx="0.6" />
      <rect x="12.3" y="7" width="3" height="2" rx="0.6" />
    </g>
    <g transform="rotate(45 8 8)">
      <rect x="7" y="0.7" width="2" height="3" rx="0.6" />
      <rect x="7" y="12.3" width="2" height="3" rx="0.6" />
      <rect x="0.7" y="7" width="3" height="2" rx="0.6" />
      <rect x="12.3" y="7" width="3" height="2" rx="0.6" />
    </g>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 2.1a5.9 5.9 0 1 0 0 11.8 5.9 5.9 0 0 0 0-11.8Zm0 3.6a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z"
    />
  </svg>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <rect x="2" y="3.6" width="12" height="1.9" rx="0.95" />
    <rect x="2" y="7.05" width="12" height="1.9" rx="0.95" />
    <rect x="2" y="10.5" width="12" height="1.9" rx="0.95" />
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

// Two 4-point sparkles — the "AI" affordance.
export const SparkleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M7 1.6c.35 2.85 1.45 3.95 4.3 4.3-2.85.35-3.95 1.45-4.3 4.3-.35-2.85-1.45-3.95-4.3-4.3 2.85-.35 3.95-1.45 4.3-4.3Z" />
    <path d="M12.2 9.1c.18 1.45.74 2.02 2.2 2.2-1.46.18-2.02.74-2.2 2.2-.18-1.46-.74-2.02-2.2-2.2 1.46-.18 2.02-.75 2.2-2.2Z" />
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

// Paper-plane — the Publish (send to channels) section.
export const LoginIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8.5 2.5h4A1.5 1.5 0 0 1 14 4v8a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 7 12v-1.2a.8.8 0 0 1 1.6 0v1.1H12V4.1H8.6v1.1a.8.8 0 1 1-1.6 0V4a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M5.06 5.64 7.7 7.4a.7.7 0 0 1 0 1.2l-2.64 1.76a.7.7 0 0 1-1.09-.58V8.8H2.3a.8.8 0 0 1 0-1.6h1.67V6.22a.7.7 0 0 1 1.09-.58Z" />
  </svg>
);

export const PublishIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M13.6 2.4 1.9 7.1a.6.6 0 0 0 .05 1.12l3.4 1.1 1.1 3.4a.6.6 0 0 0 1.12.05L13.6 2.4Zm-1.5 1.5L6.9 9.1l-.02.02-2.2-.7 7.42-3.0ZM7.5 10.1l-.7-2.2 5.2-5.2-4.5 7.4Z" />
  </svg>
);

// Down-arrow into a tray — Import media (download in).
export const ImportIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8 1.6a.8.8 0 0 1 .8.8v5.07l1.43-1.43a.8.8 0 1 1 1.13 1.13L8.57 10.1a.8.8 0 0 1-1.13 0L4.64 7.17a.8.8 0 0 1 1.13-1.13L7.2 7.47V2.4A.8.8 0 0 1 8 1.6Z" />
    <path d="M2.6 9.6a.8.8 0 0 1 .8.8v1.6h9.2v-1.6a.8.8 0 0 1 1.6 0v2a1.2 1.2 0 0 1-1.2 1.2H3a1.2 1.2 0 0 1-1.2-1.2v-2a.8.8 0 0 1 .8-.8Z" />
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

export const BellIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path d="M8 1.4a3.9 3.9 0 0 0-3.9 3.9v2.05c0 .5-.2.98-.55 1.33l-.62.62A1.05 1.05 0 0 0 3.68 11.1h8.64a1.05 1.05 0 0 0 .74-1.79l-.62-.62a1.88 1.88 0 0 1-.55-1.33V5.3A3.9 3.9 0 0 0 8 1.4Z" />
    <path d="M6.35 12.1a1.7 1.7 0 0 0 3.3 0H6.35Z" />
  </svg>
);

// Two interlocking links — Connections.
export const ConnectionsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} className="icon">
    <path
      d="M6.2 9.8 9.8 6.2M6.5 4.5l1-1a2.7 2.7 0 0 1 3.8 3.8l-1 1M9.5 11.5l-1 1a2.7 2.7 0 0 1-3.8-3.8l1-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);
