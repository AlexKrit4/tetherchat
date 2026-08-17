import type { ReactNode } from 'react';
import { TetherWordmark } from '@/components/brand/TetherLogo';

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
  return (
    <div className="flex min-h-screen-dvh flex-col items-center justify-center bg-surface-tertiary px-safe pb-safe pt-safe md:p-6">
      <div className="flex w-full max-w-[480px] flex-col gap-6 bg-surface p-6 md:rounded-lg md:p-8 md:shadow-floating">
        <div className="flex flex-col items-center gap-3 text-center">
          <TetherWordmark />
          <div>
            <h1 className="text-2xl font-bold text-text-heading">{title}</h1>
            {subtitle ? <p className="mt-1 text-base text-text-muted">{subtitle}</p> : null}
          </div>
        </div>

        {children}

        {footer ? <div className="text-sm text-text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
