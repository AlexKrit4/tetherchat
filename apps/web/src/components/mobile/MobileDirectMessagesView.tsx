import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { DirectMessageList } from '@/components/layout/DirectMessageList';
import { UserPanel } from '@/components/layout/UserPanel';
import { IconButton } from '@/components/ui/IconButton';
import { NewConversationDialog } from '@/components/modals/NewConversationDialog';
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
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-surface-secondary">
      <MobileHeader
        title={t('dm.title')}
        onBack={() => setMobileView('servers')}
        actions={
          <IconButton
            icon={PenSquare}
            label={t('nav.newConversation')}
            size="lg"
            showTooltip={false}
            onClick={() => setNewOpen(true)}
          />
        }
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

      <NewConversationDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
