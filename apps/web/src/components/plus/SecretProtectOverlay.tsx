import { useEffect, useState } from 'react';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/i18n/useT';

/** Blurs the secret chat when the tab is hidden or the window loses focus. Plus only. */
export function SecretProtectOverlay() {
  const t = useT();
  const plus = useAuthStore((state) => state.user?.isPlus);
  const { conversation } = useChatTarget();
  const [hidden, setHidden] = useState(false);
  const active = Boolean(plus && conversation?.isSecret);

  useEffect(() => {
    if (!active) {
      setHidden(false);
      return;
    }
    const sync = () => {
      setHidden(document.hidden || !document.hasFocus());
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('blur', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('blur', sync);
      window.removeEventListener('focus', sync);
    };
  }, [active]);

  if (!active || !hidden) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-2xl">
      <p className="rounded-xl bg-surface px-4 py-3 text-base font-semibold text-text-heading shadow-elevated">
        {t('plus.chatHidden')}
      </p>
    </div>
  );
}
