import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Fills the screen instead of hugging its content (emoji picker, long lists). */
  full?: boolean;
  className?: string;
}

const DRAG_CLOSE_PX = 96;
const DRAG_CLOSE_VELOCITY = 500;

/**
 * The mobile counterpart of a modal: slides up from the bottom, respects the home
 * indicator inset, and can be dismissed by dragging the handle down.
 */
export function BottomSheet({ open, onClose, title, children, full, className }: BottomSheetProps) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pt-safe"
          role="dialog"
          aria-modal="true"
        >
          <motion.button
            type="button"
            aria-label={t('common.close')}
            className="absolute inset-0 bg-surface-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          <motion.div
            ref={sheetRef}
            className={cn(
              'relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl bg-surface pb-safe shadow-sheet',
              full ? 'h-[90dvh]' : 'max-h-[90dvh]',
              className,
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_event, info) => {
              if (info.offset.y > DRAG_CLOSE_PX || info.velocity.y > DRAG_CLOSE_VELOCITY) onClose();
            }}
          >
            <div className="flex shrink-0 justify-center pt-2.5" aria-hidden>
              <span className="h-1 w-9 rounded-sm bg-[#4e5058]" />
            </div>

            {title ? (
              <h2 className="shrink-0 px-4 pb-1 pt-3 text-base font-semibold text-text-heading">{title}</h2>
            ) : null}

            <div className="scroller min-h-0 flex-1 overflow-y-auto px-1 pb-2">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export interface SheetActionProps {
  icon?: ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/** 48px rows keep every sheet action inside the comfortable touch range. */
export function SheetAction({ icon, label, hint, onSelect, tone = 'default', disabled }: SheetActionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded px-3 text-left text-base',
        'active:bg-surface-hover disabled:opacity-40',
        tone === 'danger' ? 'text-danger' : 'text-text',
      )}
    >
      {icon ? <span className="flex h-6 w-6 items-center justify-center text-text-muted">{icon}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {hint ? <span className="truncate text-xs text-text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}
