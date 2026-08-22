import { useCallback, useEffect, useRef, useState } from 'react';
import type { QrLoginStart } from '@tetherchat/shared';
import { Spinner } from '@/components/ui/Spinner';
import { useT } from '@/i18n/useT';
import { useAuthStore } from '@/stores/authStore';

interface QrLoginPanelProps {
  onSuccess: () => void;
  onExpired: () => void;
}

export function QrLoginPanel({ onSuccess, onExpired }: QrLoginPanelProps) {
  const t = useT();
  const startQrLogin = useAuthStore((state) => state.startQrLogin);
  const pollQrLogin = useAuthStore((state) => state.pollQrLogin);
  const cancelQrLogin = useAuthStore((state) => state.cancelQrLogin);

  const [session, setSession] = useState<QrLoginStart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ticketRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (ticketRef.current) {
        await cancelQrLogin(ticketRef.current).catch(() => undefined);
      }
      const next = await startQrLogin();
      if (!mountedRef.current) return;
      ticketRef.current = next.ticket;
      setSession(next);
    } catch {
      if (mountedRef.current) setError(t('auth.qrStartFailed'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [cancelQrLogin, startQrLogin, t]);

  useEffect(() => {
    mountedRef.current = true;
    void bootstrap();
    return () => {
      mountedRef.current = false;
      const ticket = ticketRef.current;
      if (ticket) void cancelQrLogin(ticket).catch(() => undefined);
    };
  }, [bootstrap, cancelQrLogin]);

  useEffect(() => {
    const ticket = session?.ticket;
    if (!ticket) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await pollQrLogin(ticket);
        if (cancelled) return;
        if (result.status === 'approved') {
          ticketRef.current = null;
          onSuccess();
          return;
        }
        if (result.status === 'expired') {
          onExpired();
        }
      } catch {
        if (!cancelled) setError(t('auth.qrPollFailed'));
      }
    };

    const id = window.setInterval(() => {
      void poll();
    }, 2000);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [onExpired, onSuccess, pollQrLogin, session?.ticket, t]);

  if (loading && !session) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Spinner className="h-8 w-8 text-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-sm text-danger">{error}</p>
        <button type="button" className="text-sm text-text-link hover:underline" onClick={() => void bootstrap()}>
          {t('auth.qrRetry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      {session ? (
        <img
          src={session.qrDataUrl}
          alt={t('auth.qrAlt')}
          className="h-[220px] w-[220px] rounded-xl bg-white p-3 shadow-elevated"
        />
      ) : null}
      <p className="max-w-sm text-sm text-text-muted">{t('auth.qrHint')}</p>
      <p className="text-xs text-text-faint">{t('auth.qrWaiting')}</p>
      <button type="button" className="text-sm text-text-link hover:underline" onClick={() => void bootstrap()}>
        {t('auth.qrRefresh')}
      </button>
    </div>
  );
}
