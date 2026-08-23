import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';

export function CallOverlay() {
  const t = useT();
  const phase = useCallStore((state) => state.phase);
  const peer = useCallStore((state) => state.peer);
  const muted = useCallStore((state) => state.muted);
  const error = useCallStore((state) => state.error);
  const acceptIncoming = useCallStore((state) => state.acceptIncoming);
  const declineIncoming = useCallStore((state) => state.declineIncoming);
  const endCall = useCallStore((state) => state.endCall);
  const setMuted = useCallStore((state) => state.setMuted);

  useLiveKitRoom();

  if (phase === 'idle' && !error) return null;

  const label =
    phase === 'outgoing'
      ? t('call.calling')
      : phase === 'ringing'
        ? t('call.incoming')
        : phase === 'connecting'
          ? t('call.connecting')
          : phase === 'active'
            ? t('call.active')
            : t('call.ended');

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-surface p-8 shadow-floating">
        {peer ? (
          <Avatar
            user={{ ...peer, status: 'online' }}
            size={88}
            showStatus={false}
          />
        ) : (
          <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-surface-active">
            <Phone size={36} className="text-brand" aria-hidden />
          </span>
        )}

        <div className="text-center">
          <p className="text-xl font-semibold text-text-heading">
            {peer?.displayName ?? peer?.username ?? t('call.unknown')}
          </p>
          <p className="mt-1 text-sm text-text-muted">{error ?? label}</p>
        </div>

        {phase === 'ringing' ? (
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => void declineIncoming()}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3',
                'text-sm font-semibold text-white',
              )}
            >
              <PhoneOff size={18} aria-hidden />
              {t('call.decline')}
            </button>
            <button
              type="button"
              onClick={() => void acceptIncoming()}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3',
                'text-sm font-semibold text-white',
              )}
            >
              <Phone size={18} aria-hidden />
              {t('call.accept')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {phase === 'active' ? (
              <button
                type="button"
                onClick={() => setMuted(!muted)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-active text-text-heading"
                aria-label={muted ? t('call.unmute') : t('call.mute')}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void endCall()}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white"
              aria-label={t('call.hangUp')}
            >
              <PhoneOff size={22} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
