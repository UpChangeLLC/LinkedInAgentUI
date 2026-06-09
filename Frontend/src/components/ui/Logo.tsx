import { clsx } from 'clsx';
import fullSvg from '../../assets/logo/upchange-full.svg?raw';
import compactSvg from '../../assets/logo/upchange-compact.svg?raw';
import iconSvg from '../../assets/logo/upchange-icon.svg?raw';

export type LogoVariant = 'full' | 'compact' | 'mark';
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

export interface LogoProps {
  /** `full` = icon + UPCHANGE + tagline (large surfaces) · `compact` = icon +
   *  UPCHANGE (nav/sidebar) · `mark` = brain-circuit icon only. */
  variant?: LogoVariant;
  /** Token-based height; width scales to keep aspect ratio. */
  size?: LogoSize;
  className?: string;
}

// Official Upchange artwork, inlined so the monochrome mark inherits the
// surrounding text color via `currentColor` (adapts to light/dark + any surface).
const SRC: Record<LogoVariant, string> = {
  full: fullSvg.replace(/<\?xml[^>]*\?>/, ''),
  compact: compactSvg.replace(/<\?xml[^>]*\?>/, ''),
  mark: iconSvg.replace(/<\?xml[^>]*\?>/, ''),
};

const HEIGHT: Record<LogoSize, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-10',
  xl: 'h-14',
};

export function Logo({ variant = 'compact', size = 'md', className }: LogoProps) {
  return (
    <span
      role="img"
      aria-label="Upchange"
      data-logo-variant={variant}
      className={clsx(
        'inline-block shrink-0 select-none align-middle',
        '[&>svg]:block [&>svg]:h-full [&>svg]:w-auto',
        HEIGHT[size],
        className,
      )}
      dangerouslySetInnerHTML={{ __html: SRC[variant] }}
    />
  );
}
