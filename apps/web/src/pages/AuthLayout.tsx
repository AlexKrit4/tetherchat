import type { ReactNode } from 'react';
import { TetherWordmark } from '@/components/brand/TetherLogo';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';

/**
 * Auth screens are a single centred card on desktop and a full-bleed form on
 * phones, where a floating card would waste vertical space.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const graphite = isGraphite();

  return (
    <div
      className={cn(
        'flex min-h-screen-dvh flex-col items-center justify-center px-safe pb-safe pt-safe',
        graphite ? 'bg-surface-tertiary md:p-8' : 'bg-surface-tertiary md:p-6',
      )}
    >
      <div
        className={cn(
          'flex w-full max-w-[480px] flex-col gap-6 bg-surface p-6',
          graphite
            ? 'md:rounded-xl md:p-8 md:shadow-hairline-strong'
            : 'md:rounded-lg md:p-8 md:shadow-floating',
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <TetherWordmark />
          <div>
            <h1
              className={cn(
                'text-2xl font-bold text-text-heading',
                graphite && 'tracking-heading',
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className={cn('mt-1 text-base text-text-muted', graphite && 'text-sm')}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {children}

        {footer ? <div className="text-sm text-text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
