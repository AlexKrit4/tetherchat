import { appTheme, isGraphite, isPreviewBuild } from '@/lib/theme';
import { cn } from '@/lib/cn';

const PREVIEW_LABEL: Record<typeof appTheme, string> = {
  classic: '',
  aurora: 'Aurora',
  graphite: 'Graphite',
};

/**
 * Corner chip on preview builds. It used to be a full-width bar at z-100 that
 * sat on top of the server rail, chat header and command palette.
 */
export function PreviewBanner() {
  if (!isPreviewBuild()) return null;

  const label = PREVIEW_LABEL[appTheme];
  const graphite = isGraphite();

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 pb-safe pr-safe">
      <div
        className={cn(
          'pointer-events-auto flex max-w-[min(92vw,280px)] items-center gap-2 px-2.5 py-1.5 text-xs text-text-muted',
          graphite
            ? 'rounded-md bg-surface-floating shadow-hairline'
            : 'rounded-full border border-white/10 bg-[rgba(8,9,16,0.88)] shadow-floating backdrop-blur-md',
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
        <p className="min-w-0 truncate">
          <span className="font-medium text-text-heading">{label}</span>
          {' · '}
          <a href="https://tetherchat.ru/" className="text-text-link hover:underline">
            прод
          </a>
        </p>
      </div>
    </div>
  );
}
