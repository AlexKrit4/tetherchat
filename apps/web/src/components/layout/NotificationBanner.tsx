import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { enablePush, pushState } from '@/lib/push';
import { toast } from '@/stores/toastStore';

/**
 * Permission prompts only stick when they come from a click. Auto-requesting
 * on login is ignored on Android WebView and in most browsers.
 */
export function NotificationBanner() {
  const t = useT();
  const [state, setState] = useState(() => pushState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => setState(pushState());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    let permissionStatus: PermissionStatus | undefined;
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((status) => {
        permissionStatus = status;
        status.onchange = refresh;
        refresh();
      })
      .catch(() => undefined);

    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  const hidden =
    !state.supported ||
    state.subscribed ||
    state.permission === 'granted' ||
    state.permission === 'denied' ||
    state.permission === 'unsupported';

  if (hidden) return null;

  const onEnable = async () => {
    setBusy(true);
    try {
      window.TetherChatNative?.requestNotifications?.();
      const result = await enablePush();
      if (result === 'denied') toast.error(t('settings.pushBlocked'));
      else if (result === 'unsupported' || result === 'no-key') {
        toast.error(t('settings.pushUnsupportedToast'));
      } else {
        toast.success(t('settings.pushOn'));
      }
      setState(pushState());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[98] flex items-center justify-center gap-3 bg-brand px-3 py-2 pt-safe text-sm text-white"
    >
      <Bell size={14} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 text-center sm:flex-none">{t('settings.pushBanner')}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onEnable()}
        className="shrink-0 rounded bg-white/15 px-2.5 py-1 text-sm font-semibold hover:bg-white/25 disabled:opacity-60"
      >
        {t('settings.pushBannerAction')}
      </button>
    </div>
  );
}
