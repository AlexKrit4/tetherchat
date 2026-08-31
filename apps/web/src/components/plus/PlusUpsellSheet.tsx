import { Sparkles } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n/useT';
import { usePlusStore, type PlusReason } from '@/stores/plusStore';
import { useUiStore } from '@/stores/uiStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

const REASON_KEYS: Record<PlusReason, string> = {
  generic: 'plus.upsellGeneric',
  files: 'plus.upsellFiles',
  pins: 'plus.upsellPins',
  bio: 'plus.upsellBio',
  transcript: 'plus.upsellTranscript',
  colors: 'plus.upsellColors',
  lastSeen: 'plus.upsellLastSeen',
  wallpaper: 'plus.upsellWallpaper',
  accounts: 'plus.upsellAccounts',
  secret: 'plus.upsellSecret',
};

export function PlusUpsellSheet() {
  const t = useT();
  const reason = usePlusStore((state) => state.reason);
  const hide = usePlusStore((state) => state.hide);
  const isMobile = useIsMobile();
  const pushMobileView = useUiStore((state) => state.pushMobileView);

  return (
    <BottomSheet open={Boolean(reason)} onClose={hide} title={t('plus.title')}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center gap-2 text-warning">
          <Sparkles size={20} aria-hidden />
          <p className="text-base font-semibold text-text-heading">{t('plus.upsellTitle')}</p>
        </div>
        <p className="text-sm text-text">{t(REASON_KEYS[reason ?? 'generic'])}</p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-text-muted">
          <li>{t('plus.perkFiles')}</li>
          <li>{t('plus.perkPins')}</li>
          <li>{t('plus.perkTranscript')}</li>
          <li>{t('plus.perkBadge')}</li>
        </ul>
        <Button
          onClick={() => {
            hide();
            if (isMobile) pushMobileView('settings');
          }}
        >
          {t('plus.openSettings')}
        </Button>
      </div>
    </BottomSheet>
  );
}
