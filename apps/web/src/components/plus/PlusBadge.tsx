import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';

export function PlusBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      title={t('plus.badge')}
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-[#faa81a] to-[#ed4245] px-0.5 text-[10px] font-bold leading-none text-white',
        className,
      )}
      aria-label={t('plus.badge')}
    >
      ★
    </span>
  );
}
