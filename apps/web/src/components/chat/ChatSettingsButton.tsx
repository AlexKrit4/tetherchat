import { useRef, useState } from 'react';
import { Ban, Image as ImageIcon, LogOut, Settings, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ChannelNotificationSetting, DirectConversation } from '@tetherchat/shared';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/components/ui/IconButton';
import { BottomSheet, SheetAction } from '@/components/ui/BottomSheet';
import { useChatTarget, DM_ROUTE } from '@/hooks/useChatTarget';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useLeaveConversation } from '@/hooks/useDms';
import { useBlockUser } from '@/components/settings/BlacklistSettings';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { usePlusStore } from '@/stores/plusStore';
import { queryKeys } from '@/lib/queryKeys';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';

export function ChatSettingsButton() {
  const t = useT();
  const { isDm, conversation, title, channelId } = useChatTarget();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const isPlus = useAuthStore((state) => state.user?.isPlus);
  const showPlus = usePlusStore((state) => state.show);
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
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const peer = conversation?.members.find((member) => member.id !== currentUserId);
  const peerName = peer?.displayName ?? peer?.username ?? title;

  const uploadWallpaper = async (file: File) => {
    if (!isPlus) {
      showPlus('wallpaper');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      if (isDm && conversation) {
        const updated = await api.post<DirectConversation>(`/api/dms/${conversation.id}/wallpaper`, form);
        client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) =>
          current?.map((row) => (row.id === updated.id ? updated : row)),
        );
      } else if (channelId) {
        await api.post<ChannelNotificationSetting>(`/api/channels/${channelId}/wallpaper`, form);
        void client.invalidateQueries({ queryKey: queryKeys.channelNotifications(channelId) });
      }
      toast.success(t('plus.changeWallpaper'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeWallpaper = async () => {
    try {
      if (isDm && conversation) {
        const updated = await api.delete<DirectConversation>(`/api/dms/${conversation.id}/wallpaper`);
        client.setQueryData<DirectConversation[]>(queryKeys.dms, (current) =>
          current?.map((row) => (row.id === updated.id ? updated : row)),
        );
      } else if (channelId) {
        await api.delete<ChannelNotificationSetting>(`/api/channels/${channelId}/wallpaper`);
        void client.invalidateQueries({ queryKey: queryKeys.channelNotifications(channelId) });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

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
        <SheetAction
          icon={<ImageIcon size={18} aria-hidden />}
          label={t('plus.changeWallpaper')}
          onSelect={() => {
            if (!isPlus) {
              setOpen(false);
              showPlus('wallpaper');
              return;
            }
            fileRef.current?.click();
          }}
        />
        <SheetAction
          icon={<ImageIcon size={18} aria-hidden />}
          label={t('plus.removeWallpaper')}
          onSelect={() => {
            setOpen(false);
            void removeWallpaper();
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
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void uploadWallpaper(file);
          setOpen(false);
        }}
      />
    </>
  );
}
