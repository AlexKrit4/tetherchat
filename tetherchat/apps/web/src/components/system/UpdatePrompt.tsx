import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';

/**
 * The service worker waits for consent before taking over, so an update never
 * reloads the page while someone is typing.
 */
export function UpdatePrompt() {
  const t = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => console.warn('[pwa] registration failed', error),
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-[96] flex items-center gap-3 rounded-lg bg-surface-floating p-3 shadow-floating md:left-auto md:right-6 md:w-[360px]">
      <Download size={18} className="shrink-0 text-brand" aria-hidden />
      <p className="min-w-0 flex-1 text-base text-text">{t('update.ready')}</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        {t('update.later')}
      </Button>
    </div>
  );
}
