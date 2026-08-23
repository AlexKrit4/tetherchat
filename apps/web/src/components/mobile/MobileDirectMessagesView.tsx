import { useNavigate } from 'react-router-dom';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { DirectMessageList } from '@/components/layout/DirectMessageList';
import { UserPanel } from '@/components/layout/UserPanel';
import { MobileHeader } from './MobileHeader';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/i18n/useT';

export function MobileDirectMessagesView() {
  const t = useT();
  const navigate = useNavigate();
  const { channelId } = useChatTarget();
  const setMobileView = useUiStore((state) => state.setMobileView);
  const pushMobileView = useUiStore((state) => state.pushMobileView);

  return (
    <div className="flex h-full flex-col bg-surface-secondary">
      <MobileHeader
        title={t('dm.title')}
        onBack={() => setMobileView('servers')}
      />

      <div className="scroller flex-1">
        <DirectMessageList
          activeConversationId={channelId}
          compact={false}
          onSelect={(conversation) => {
            navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
            pushMobileView('chat');
          }}
        />
      </div>

      <UserPanel className="pb-safe" />
    </div>
  );
}
