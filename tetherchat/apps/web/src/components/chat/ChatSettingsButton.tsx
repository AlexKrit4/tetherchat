import { useState } from 'react';
import { Ban, LogOut, Settings, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/components/ui/IconButton';
import { BottomSheet, SheetAction } from '@/components/ui/BottomSheet';
import { useChatTarget, DM_ROUTE } from '@/hooks/useChatTarget';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useLeaveConversation } from '@/hooks/useDms';
import { useBlockUser } from '@/components/settings/BlacklistSettings';
import { errorMessage } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';

export function ChatSettingsButton() {
  const t = useT();
  const { isDm, conversation, title } = useChatTarget();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const popMobileView = useUiStore((state) => state.popMobileView);
  const toggleMembers = useUiStore((state) => state.toggleMembers);
  const toggleMembersOverlay = useUiStore((state) => state.toggleMembersOverlay);
  const leave = useLeaveConversation();
  const block = useBlockUser();

  const peer = conversation?.members.find((member) => member.id !== currentUserId);
  const peerName = peer?.displayName ?? peer?.username ?? title;

  return (
    <>
      <IconButton
        icon={Settings}
        label={t('chat.chatSettings')}
        size={isMobile ? 'lg' : 'md'}
        onClick={() => setOpen(true)}
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('chat.chatSettings')}>
        <SheetAction
          icon={<Users size={18} aria-hidden />}
          label={t('common.members')}
          onSelect={() => {
            setOpen(false);
            if (isMobile) pushMobileView('members');
            else if (isDesktop) toggleMembers();
            else toggleMembersOverlay();
          }}
        />
        {isDm && conversation?.isGroup ? (
          <SheetAction
            icon={<LogOut size={18} aria-hidden />}
            label={t('nav.leaveGroup')}
            tone="danger"
            onSelect={() => {
              setOpen(false);
              leave.mutate(conversation.id, {
                onSuccess: () => {
                  navigate(`/channels/${DM_ROUTE}`);
                  if (isMobile) popMobileView();
                },
                onError: (error) => toast.error(errorMessage(error)),
              });
            }}
          />
        ) : null}
        {isDm && peer && !conversation?.isGroup ? (
          <SheetAction
            icon={<Ban size={18} aria-hidden />}
            label={t('settings.blockUser')}
            tone="danger"
            onSelect={() => {
              if (!window.confirm(t('settings.blockConfirm', { name: peerName }))) return;
              setOpen(false);
              block.mutate(peer.id, {
                onSuccess: () => {
                  navigate(`/channels/${DM_ROUTE}`);
                  if (isMobile) popMobileView();
                },
              });
            }}
          />
        ) : null}
      </BottomSheet>
    </>
  );
}
