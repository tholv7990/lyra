// Minimal line icons (16px, stroke = currentColor) — Linear-ish.
import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const HomeIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <path d="M2.5 6.5 8 2l5.5 4.5V13a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V6.5Z" />
    <path d="M6 14V9h4v5" />
  </svg>
);

export const ProjectsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z" />
  </svg>
);

export const MembersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <circle cx="6" cy="6" r="2.25" />
    <path d="M2.5 13c0-2 1.6-3.25 3.5-3.25S9.5 11 9.5 13" />
    <path d="M10.5 4.2A2 2 0 0 1 11 8M11 9.9c1.6.1 2.8 1.2 2.8 3.1" />
  </svg>
);

export const PromptsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H6.5L3.5 13V10.5H4A1.5 1.5 0 0 1 2.5 9V4Z" />
    <path d="M5 5.5h6M5 7.5h3.5" />
  </svg>
);

export const PipelinesIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <circle cx="4" cy="4" r="1.6" />
    <circle cx="4" cy="12" r="1.6" />
    <circle cx="12" cy="8" r="1.6" />
    <path d="M5.6 4H9a1.5 1.5 0 0 1 1.5 1.5v1M5.6 12H9a1.5 1.5 0 0 0 1.5-1.5v-1" />
  </svg>
);

export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v1.7M8 12.8v1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M1.5 8h1.7M12.8 8h1.7M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" />
  </svg>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
  </svg>
);

export const ChevronIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 14, height: 14, ...p })} className="ws-chevron">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 14, height: 14, ...p })} className="check">
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
);

export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.7 8.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4.5" />
  </svg>
);

export const LogoutIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className="icon">
    <path d="M6 14H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1H6" />
    <path d="M10 11l3-3-3-3M13 8H6" />
  </svg>
);
