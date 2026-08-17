import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { disablePush, enablePush, pushState } from '@/lib/push';
import { toast } from '@/stores/toastStore';

/** Web push opt-in plus the local desktop-notification toggle. */
export function NotificationSettings() {
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
          toast.error('Notifications are blocked in your browser settings');
        } else if (result === 'unsupported') {
          toast.error('This browser cannot receive push notifications');
        } else {
          toast.success('Push notifications enabled');
        }
      } else {
        await disablePush();
        toast.info('Push notifications disabled');
      }
      setState(pushState());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-lg bg-base-secondary p-4">
        {state.subscribed ? (
          <Bell size={20} className="mt-0.5 shrink-0 text-success" aria-hidden />
        ) : (
          <BellOff size={20} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-text-heading">Push notifications</p>
          <p className="mt-1 text-sm text-text-muted">
            Get notified about mentions and direct messages even when TetherChat is closed.
            {state.supported ? '' : ' Not supported in this browser.'}
          </p>
        </div>
        <Toggle
          checked={state.subscribed}
          disabled={!state.supported || busy}
          label="Push notifications"
          onChange={(next) => void toggle(next)}
        />
      </div>

      {state.permission === 'denied' ? (
        <p className="text-sm text-danger">
          Notifications are blocked for this site. Allow them in your browser settings, then try again.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-text-heading">Per-channel settings</p>
        <p className="text-sm text-text-muted">
          Mute a single channel from its context menu in the channel list.
        </p>
        <Button variant="secondary" disabled>
          Managed per channel
        </Button>
      </div>
    </div>
  );
}
