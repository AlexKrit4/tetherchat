import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link' | 'success';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
  secondary: 'bg-control text-text-heading hover:bg-control-hover active:bg-control-active',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  success: 'bg-success text-white hover:brightness-110',
  ghost: 'bg-transparent text-text-subheading hover:bg-surface-hover hover:text-text-heading',
  link: 'bg-transparent text-text-link hover:underline px-0',
};

/**
 * Graphite outlines the neutral variant instead of relying on its fill, which
 * is barely a tint against the near-black surfaces it sits on.
 */
const outlined: Partial<Record<Variant, string>> = {
  secondary: 'shadow-hairline-strong',
};

// 44px is the minimum comfortable touch target, so md and lg both clear it.
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 min-h-touch px-4 text-base md:min-h-0',
  lg: 'h-11 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded font-medium',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        isGraphite() && outlined[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});
