import { appTheme, isGraphite, isPreviewBuild } from '@/lib/theme';
import { cn } from '@/lib/cn';

const PREVIEW_LABEL: Record<typeof appTheme, string> = {
  classic: '',
  aurora: 'Aurora',
  graphite: 'Graphite',
};

/** Shown on preview builds (Aurora :1488, Graphite :1489). */
export function PreviewBanner() {
  if (!isPreviewBuild()) return null;

  const label = PREVIEW_LABEL[appTheme];
  const graphite = isGraphite();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-safe">
      <div
        className={cn(
          'pointer-events-auto mt-2 flex max-w-[min(92vw,720px)] items-center gap-2.5 px-3 py-1.5',
          graphite
            ? 'rounded-md bg-surface-floating text-text-muted shadow-hairline'
            : 'rounded-full border border-white/10 bg-[rgba(8,9,16,0.88)] px-4 py-2 shadow-floating backdrop-blur-md',
        )}
      >
        <span
          className={cn(
            'shrink-0 text-2xs font-semibold uppercase tracking-wider',
            graphite
              ? 'rounded-sm bg-surface-accent px-1.5 py-0.5 text-text-subheading'
              : 'rounded-full bg-gradient-to-r from-teal-400 via-indigo-400 to-rose-400 px-2 py-0.5 font-extrabold text-[#0a0b10]',
          )}
        >
          Макет
        </span>
        <p className={cn('text-xs', !graphite && 'sm:text-sm')}>
          {graphite ? (
            <>
              <span className="font-medium text-text-heading">{label}</span>
              {' — '}
              экспериментальный редизайн. Прод на{' '}
              <a href="https://tetherchat.ru/" className="text-text-link hover:underline">
                tetherchat.ru
              </a>
              .
            </>
          ) : (
            <>
              <span className="font-semibold text-text-heading">{label}</span> — экспериментальный
              редизайн. Прод на{' '}
              <a href="https://tetherchat.ru/" className="text-text-link hover:underline">
                tetherchat.ru
              </a>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}
