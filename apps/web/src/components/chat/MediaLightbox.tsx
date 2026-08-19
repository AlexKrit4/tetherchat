import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { isImageMime, isVideoMime } from '@tetherchat/shared';
import type { Attachment, ChatMediaItem } from '@tetherchat/shared';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

type Media = Pick<Attachment, 'id' | 'url' | 'filename' | 'contentType'> & { spoiler?: boolean };

export function MediaLightbox<T extends Media>({
  items,
  current,
  onClose,
  onChange,
}: {
  items: T[];
  current: T | null;
  onClose: () => void;
  onChange: (item: T) => void;
}) {
  const t = useT();
  const [scale, setScale] = useState(1);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setScale(1);
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!current) return null;
  const index = Math.max(0, items.findIndex((item) => item.id === current.id));
  const spoiler = Boolean(current.spoiler) && !revealed.has(current.id);

  const step = (delta: number) => {
    if (items.length === 0) return;
    const next = items[(index + delta + items.length) % items.length];
    if (next) onChange(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(0,0,0,0.92)]"
      onClick={onClose}
      onWheel={(event) => {
        event.preventDefault();
        setScale((value) => Math.min(5, Math.max(1, value + (event.deltaY < 0 ? 0.15 : -0.15))));
      }}
    >
      <button
        type="button"
        aria-label={t('common.close')}
        className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] z-10 flex h-touch w-touch items-center justify-center rounded-full bg-surface-floating text-text-heading"
        onClick={onClose}
      >
        <X size={22} aria-hidden />
      </button>
      {items.length > 1 ? (
        <>
          <button
            type="button"
            aria-label={t('common.back')}
            className="absolute left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-surface-floating text-text-heading"
            onClick={(event) => {
              event.stopPropagation();
              step(-1);
            }}
          >
            <ChevronLeft size={28} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t('chat.nextMedia')}
            className="absolute right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-surface-floating text-text-heading"
            onClick={(event) => {
              event.stopPropagation();
              step(1);
            }}
          >
            <ChevronRight size={28} aria-hidden />
          </button>
        </>
      ) : null}

      <div
        className="flex max-h-full max-w-full items-center justify-center p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {isImageMime(current.contentType) ? (
          <button
            type="button"
            className="relative"
            onClick={() => {
              if (spoiler) setRevealed((set) => new Set(set).add(current.id));
            }}
          >
            <img
              src={current.url}
              alt={current.filename}
              style={{ transform: `scale(${scale})` }}
              className={cn(
                'max-h-[90dvh] max-w-[90vw] rounded-lg object-contain transition',
                spoiler && 'blur-2xl brightness-50',
              )}
              draggable={false}
            />
            {spoiler ? (
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
                {t('chat.spoilerReveal')}
              </span>
            ) : null}
          </button>
        ) : isVideoMime(current.contentType) ? (
          <video src={current.url} controls className="max-h-[90dvh] max-w-[90vw] rounded-lg" />
        ) : null}
      </div>
    </div>
  );
}

export type { ChatMediaItem };
