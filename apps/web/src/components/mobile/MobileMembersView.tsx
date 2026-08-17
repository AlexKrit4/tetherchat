import { useT } from '@/i18n/useT';
import { MemberList } from '@/components/layout/MemberList';
import { MobileHeader } from './MobileHeader';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useUiStore } from '@/stores/uiStore';

export function MobileMembersView() {
  const t = useT();
  const popMobileView = useUiStore((state) => state.popMobileView);
  const { server, conversation, isDm } = useChatTarget();

  const count = isDm ? (conversation?.members.length ?? 0) : (server?.memberCount ?? 0);

  return (
    <div className="flex h-full flex-col bg-surface-secondary">
      <MobileHeader
        title={t('common.members')}
        subtitle={count > 0 ? t('common.total', { count }) : undefined}
        onBack={popMobileView}
      />
      <MemberList className="min-h-0 flex-1 pb-safe" compact={false} />
    </div>
  );
}
