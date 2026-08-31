import { isPreviewBuild } from '@/lib/theme';

/** Shown only on the Aurora preview build (port 1488). */
export function PreviewBanner() {
  if (!isPreviewBuild()) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-safe">
      <div className="pointer-events-auto mt-2 flex max-w-[min(92vw,720px)] items-center gap-3 rounded-full border border-white/10 bg-[rgba(8,9,16,0.88)] px-4 py-2 shadow-floating backdrop-blur-md">
        <span className="rounded-full bg-gradient-to-r from-teal-400 via-indigo-400 to-rose-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0a0b10]">
          Макет
        </span>
        <p className="text-xs text-text-muted sm:text-sm">
          <span className="font-semibold text-text-heading">Aurora</span> — экспериментальный редизайн. Прод на{' '}
          <a href="https://tetherchat.ru/" className="text-text-link hover:underline">
            tetherchat.ru
          </a>
          .
        </p>
      </div>
    </div>
  );
}
