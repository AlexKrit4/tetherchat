import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/IconButton';

export interface MobileHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}

/** Shared 56px header for every mobile view, with a 44px back target. */
export function MobileHeader({ title, subtitle, onBack, actions, className }: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-1 px-1 shadow-elevated',
        className,
      )}
    >
      {onBack ? (
        <IconButton icon={ArrowLeft} label="Back" size="lg" showTooltip={false} onClick={onBack} />
      ) : (
        <span className="w-2" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-lg font-semibold text-text-heading">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-text-muted">{subtitle}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-0.5 pr-1">{actions}</div> : null}
    </header>
  );
}
