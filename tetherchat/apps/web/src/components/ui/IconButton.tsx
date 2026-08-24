import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  /** md is 32px (desktop toolbars), lg is a 44px touch target. */
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  tone?: 'default' | 'danger';
  showTooltip?: boolean;
}

const boxes = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-touch w-touch',
};

const glyphs = {
  sm: 14,
  md: 20,
  lg: 22,
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', active, tone = 'default', className, showTooltip = true, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded transition-colors duration-150',
        boxes[size],
        tone === 'danger'
          ? 'text-text-muted hover:bg-surface-hover hover:text-danger'
          : active
            ? 'text-text-heading'
            : 'text-text-subheading hover:text-text-heading',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Icon size={glyphs[size]} strokeWidth={1.75} aria-hidden />
    </button>
  );

  if (!showTooltip) return button;
  return <Tooltip content={label}>{button}</Tooltip>;
});
