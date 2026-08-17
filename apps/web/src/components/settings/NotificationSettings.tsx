import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { disablePush, enablePush, pushState } from '@/lib/push';
import { toast } from '@/stores/toastStore';

/** Web push opt-in plus the local desktop-notification toggle. */
export function NotificationSettings() {
  const t = useT();
  const [state, setState] = useState(() => pushState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = pushState();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      if (enabled) {
        const result = await enablePush();
        if (result === 'denied') {
          toast.error(t('settings.pushBlocked'));
        } else if (result === 'unsupported') {
          toast.error(t('settings.pushUnsupportedToast'));
        } else {
          toast.success(t('settings.pushOn'));
        }
      } else {
        await disablePush();
        toast.info(t('settings.pushOff'));
      }
      setState(pushState());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg bg-surface-secondary p-4">
        {state.subscribed ? (
          <Bell size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
        ) : (
          <BellOff size={20} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-heading">{t('settings.push')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t('settings.pushHint')}
            {state.supported ? '' : t('settings.pushUnsupported')}
          </p>
        </div>
        <Toggle
          checked={state.subscribed}
          disabled={!state.supported || busy}
          label={t('settings.push')}
          onChange={(next) => void toggle(next)}
        />
      </div>

      {state.permission === 'denied' ? (
        <p className="text-sm text-danger">{t('settings.pushSiteBlocked')}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-text-heading">{t('settings.perChannel')}</p>
        <p className="text-sm text-text-muted">{t('settings.perChannelHint')}</p>
        <Button variant="secondary" disabled>
          {t('settings.managedPerChannel')}
        </Button>
      </div>
    </div>
  );
}
