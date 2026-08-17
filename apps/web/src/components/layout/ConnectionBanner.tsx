import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { ConnectionState } from '@/hooks/useRealtime';

/**
 * Thin strip pinned to the top while the socket is down. Messages still send over
 * REST in that state, so the wording says "reconnecting", not "offline".
 */
export function ConnectionBanner({ state }: { state: ConnectionState }) {
  const t = useT();
  const visible = state === 'reconnecting' || state === 'offline';

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -32, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-x-0 top-0 z-[99] flex items-center justify-center gap-2 bg-warning px-3 py-1 pt-safe text-sm font-medium text-[#1e1f22]"
        >
          <WifiOff size={14} aria-hidden />
          {state === 'offline' ? t('connection.lost') : t('connection.reconnecting')}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
