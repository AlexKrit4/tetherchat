import { useEffect, useRef, useState } from 'react';
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
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);

  useEffect(() => {
    setScale(1);
    scaleRef.current = 1;
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

  useEffect(() => {
    const node = stageRef.current;
    if (!node || !current) return;
    let startDistance = 0;
    let startScale = 1;

    const distance = (touches: TouchList) => {
      const first = touches.item(0);
      const second = touches.item(1);
      if (!first || !second) return 0;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      startDistance = distance(event.touches);
      startScale = scaleRef.current;
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length < 2 || startDistance <= 0) return;
      event.preventDefault();
      const next = Math.min(5, Math.max(1, startScale * (distance(event.touches) / startDistance)));
      scaleRef.current = next;
      setScale(next);
    };
    const onEnd = () => {
      startDistance = 0;
    };

    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', onEnd);
    node.addEventListener('touchcancel', onEnd);
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
  }, [current?.id]);

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
        setScale((value) => {
          const next = Math.min(5, Math.max(1, value + (event.deltaY < 0 ? 0.15 : -0.15)));
          scaleRef.current = next;
          return next;
        });
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
        ref={stageRef}
        className="flex max-h-full max-w-full touch-none items-center justify-center p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {isImageMime(current.contentType) ? (
          <button
            type="button"
            className="relative touch-none"
            onClick={() => {
              if (spoiler) setRevealed((set) => new Set(set).add(current.id));
            }}
          >
            <img
              src={current.url}
              alt={current.filename}
              style={{ transform: `scale(${scale})` }}
              className={cn(
                'max-h-[90dvh] max-w-[90vw] rounded-lg object-contain',
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
