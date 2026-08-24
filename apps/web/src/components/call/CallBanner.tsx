import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useCallDuration } from '@/hooks/useCallDuration';
import { useCallStore } from '@/stores/callStore';
import { useT } from '@/i18n/useT';

export function CallBanner() {
  const t = useT();
  const phase = useCallStore((state) => state.phase);
  const minimized = useCallStore((state) => state.minimized);
  const peer = useCallStore((state) => state.peer);
  const muted = useCallStore((state) => state.muted);
  const expand = useCallStore((state) => state.expand);
  const setMuted = useCallStore((state) => state.setMuted);
  const endCall = useCallStore((state) => state.endCall);
  const duration = useCallDuration();

  if (phase !== 'active' || !minimized) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(12px+var(--keyboard-offset,0px))] z-[110] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-divider bg-surface px-4 py-3 shadow-floating">
      <button
        type="button"
        onClick={expand}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={t('call.expand')}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Phone size={18} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text-heading">
            {peer?.displayName ?? peer?.username ?? t('call.unknown')}
          </span>
          <span className="block text-xs text-text-muted">{duration ?? t('call.connecting')}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-active text-text-heading"
        aria-label={muted ? t('call.unmute') : t('call.mute')}
      >
        {muted ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      <button
        type="button"
        onClick={() => void endCall()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger text-white"
        aria-label={t('call.hangUp')}
      >
        <PhoneOff size={18} aria-hidden />
      </button>
    </div>
  );
}
