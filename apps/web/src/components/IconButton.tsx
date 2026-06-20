import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonVariant = 'default' | 'primary' | 'danger' | 'success';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: ReactNode;
  /** Required — the accessible name for this icon-only control (also the tooltip). */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Boxed treatment: a hairline border + surface fill (e.g. topbar actions). */
  boxed?: boolean;
}

// The one icon-only button for the whole app: a single token-driven geometry
// with semantic variants, so every "view / open / delete / close" control reads
// the same. Prefer this over hand-rolled `<button><Icon/></button>` markup.
// Canonical action icons (see docs/lyra-design-system-actions.md):
//   view = EyeIcon · delete = XIcon (variant="danger") · close = XIcon · add = PlusIcon
export function IconButton({
  icon,
  label,
  variant = 'default',
  size = 'md',
  boxed = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = ['icon-button', `ib-${variant}`, `ib-${size}`, boxed && 'ib-boxed', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} title={label} aria-label={label} {...rest}>
      {icon}
    </button>
  );
}
