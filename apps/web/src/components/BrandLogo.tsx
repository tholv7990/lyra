import { useTheme } from '../lib/prefs';

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function BrandLogo({ className, width, height }: BrandLogoProps) {
  const { resolved } = useTheme();
  const src =
    resolved === 'dark'
      ? '/lyra-logo-horizontal-dark.svg'
      : '/lyra-logo-horizontal-light.svg';

  return <img className={className} src={src} alt="Lyra" width={width} height={height} />;
}
