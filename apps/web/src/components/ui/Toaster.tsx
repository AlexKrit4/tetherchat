import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { useToastStore } from '@/stores/toastStore';

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
};

const tones = {
  info: 'text-text-subheading',
  success: 'text-success',
  error: 'text-danger',
};

/** Bottom-centre on phones so it clears the composer, bottom-right on desktop. */
export function Toaster() {
  const t = useT();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[95] flex flex-col gap-2',
        'bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] left-4 right-4',
        'md:left-auto md:right-6 md:w-[380px]',
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = icons[toast.kind];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-lg bg-surface-floating px-3 py-3 shadow-floating"
            >
              <Icon size={18} className={cn('mt-0.5 shrink-0', tones[toast.kind])} aria-hidden />
              <p className="min-w-0 flex-1 text-base text-text">{toast.message}</p>
              <button
                type="button"
                aria-label={t('common.dismiss')}
                onClick={() => dismiss(toast.id)}
                className="shrink-0 text-text-muted transition-colors hover:text-text-heading"
              >
                <X size={16} aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
