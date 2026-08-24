import { cn } from '@/lib/cn';

/** Red mention counter. Discord uses a pill, never a circle, so 2+ digits fit. */
export function MentionBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-lg bg-danger px-1',
        'text-2xs font-bold leading-none text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** White pill on the left edge that marks unread channels and servers. */
export function UnreadPill({
  visible,
  height = 8,
  className,
}: {
  visible: boolean;
  height?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -left-2 rounded-r bg-text-heading transition-all duration-150',
        className,
      )}
      style={{ width: 4, height: visible ? height : 0, opacity: visible ? 1 : 0 }}
    />
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded bg-surface-tertiary px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
