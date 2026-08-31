import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  className?: string;
}

const widths = {
  sm: 'max-w-[440px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'sm',
  className,
}: ModalProps) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
              'relative z-10 flex w-full flex-col overflow-hidden rounded-lg bg-surface shadow-floating',
              widths[width],
              className,
            )}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {title ? (
              <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-text-heading">{title}</h2>
                  {description ? (
                    <p className="mt-1 text-base text-text-muted">{description}</p>
                  ) : null}
                </div>
                <IconButton icon={X} label={t('common.close')} onClick={onClose} showTooltip={false} />
              </header>
            ) : null}

            <div className="scroller max-h-[70vh] px-4 py-3">{children}</div>

            {footer ? (
              <footer className="flex items-center justify-end gap-2 bg-surface-secondary px-4 py-4">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
