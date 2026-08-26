import { cn } from '@/lib/cn';

/**
 * Two linked rings — the "tether" — used as the app mark on the rail, the login
 * screen and the PWA icon.
 */
export function TetherLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn('shrink-0', className)}>
      <path
        d="M12.5 20.5 19.5 13.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="10.2" cy="22.8" r="4.6" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="21.8" cy="11.2" r="4.6" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function TetherWordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TetherLogo className="h-7 w-7 text-brand" />
      <span className="text-xl font-bold tracking-tight text-text-heading">TetherChat</span>
    </div>
  );
}
