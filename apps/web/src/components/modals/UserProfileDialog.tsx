import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, MessageSquare, UserPlus } from 'lucide-react';
import type { PublicUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { memberSince } from '@/lib/time';
import { lastSeenLabel } from '@/lib/plusDisplay';
import { BioText } from '@/components/plus/BioText';
import { DisplayName } from '@/components/plus/DisplayName';
import { usePresenceStore } from '@/stores/presenceStore';
import { useT } from '@/i18n/useT';
import { DM_ROUTE, useChatTarget } from '@/hooks/useChatTarget';
import { useConversations, useCreateConversation } from '@/hooks/useDms';
import {
  isFriendOf,
  useAcceptFriendRequest,
  useFriends,
  useIncomingFriendRequests,
  useSendFriendRequest,
} from '@/hooks/useFriends';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMembers } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/stores/toastStore';
import { useBlockUser } from '@/components/settings/BlacklistSettings';

export interface UserProfileDialogProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

/** Profile card on desktop, full-height sheet on mobile. */
export function UserProfileDialog({ userId, open, onClose }: UserProfileDialogProps) {
  const t = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const { serverId, server } = useChatTarget();
  const { data: members } = useMembers(serverId);
  const { data: friends } = useFriends();
  const { data: incoming } = useIncomingFriendRequests();
  const { data: conversations } = useConversations();
  const createConversation = useCreateConversation();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const block = useBlockUser();
  const [requestSent, setRequestSent] = useState(false);
  const liveStatus = usePresenceStore((state) => (userId ? state.statuses[userId] : undefined));

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get<PublicUser>(`/api/users/${userId}`),
    enabled: open,
  });

  useEffect(() => {
    setRequestSent(false);
  }, [userId, open]);

  const member = members?.find((entry) => entry.userId === userId);
  const roles = (server?.roles ?? [])
    .filter((role) => !role.isDefault && member?.roleIds.includes(role.id))
    .sort((a, b) => b.position - a.position);

  const isFriend = isFriendOf(friends, userId);
  const incomingRequest = incoming?.find((request) => request.from.id === userId);
  const aiConversation = conversations?.find(
    (conversation) => conversation.isAi && conversation.members.some((entry) => entry.id === userId),
  );

  const openConversation = (conversationId: string) => {
    navigate(`/channels/${DM_ROUTE}/${conversationId}`);
    if (isMobile) pushMobileView('chat');
    onClose();
  };

  const openDm = () => {
    if (aiConversation) {
      openConversation(aiConversation.id);
      return;
    }
    createConversation.mutate(
      { userIds: [userId] },
      {
        onSuccess: (conversation) => openConversation(conversation.id),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <AdaptiveDialog open={open} onClose={onClose} width="sm">
      {isLoading || !user ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col">
          <div
            className="-mx-4 -mt-3 h-[60px]"
            style={{ background: user.bannerColor ?? 'var(--brand)' }}
            aria-hidden
          />

          <div className="-mt-8">
            <Avatar
              user={user}
              size={72}
              showStatus
              className="ring-6"
              ringColor="var(--bg-primary)"
            />
          </div>

          <div className="mt-3 rounded-lg bg-surface-tertiary p-3">
            <p className="text-xl font-bold text-text-heading">
              <DisplayName
                user={user}
                name={member?.nickname ?? user.displayName ?? user.username}
                className="text-xl font-bold"
              />
            </p>
            <p className="text-base text-text-muted">@{user.username}</p>
            <p className="mt-1 text-sm text-text-muted">{lastSeenLabel(user, liveStatus)}</p>

            {user.customStatus ? (
              <p className="mt-2 text-base text-text">{user.customStatus}</p>
            ) : null}

            {user.bio ? (
              <>
                <div className="my-3 h-px bg-divider" />
                <p className="text-xs font-bold uppercase tracking-[0.02em] text-text-subheading">
                  {t('profile.aboutMe')}
                </p>
                <BioText text={user.bio} plus={user.isPlus} />
              </>
            ) : null}

            {roles.length > 0 ? (
              <>
                <div className="my-3 h-px bg-divider" />
                <p className="text-xs font-bold uppercase tracking-[0.02em] text-text-subheading">
                  {t('profile.roles')}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {roles.map((role) => (
                    <span
                      key={role.id}
                      className="flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1 text-sm text-text"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: role.color ?? 'var(--grey)' }}
                      />
                      {role.name}
                    </span>
                  ))}
                </div>
              </>
            ) : null}

            <div className="my-3 h-px bg-divider" />
            <p className="text-xs font-bold uppercase tracking-[0.02em] text-text-subheading">
              {t('profile.memberSince')}
            </p>
            <p className="mt-1 text-base text-text">{memberSince(user.createdAt)}</p>

            {userId !== currentUserId ? (
              <>
                {aiConversation || isFriend ? (
                  <Button
                    fullWidth
                    className="mt-4"
                    loading={createConversation.isPending}
                    onClick={openDm}
                  >
                    <MessageSquare size={16} aria-hidden />
                    {t('profile.sendDm')}
                  </Button>
                ) : incomingRequest ? (
                  <Button
                    fullWidth
                    className="mt-4"
                    loading={acceptRequest.isPending}
                    onClick={() => acceptRequest.mutate(incomingRequest.id)}
                  >
                    <UserPlus size={16} aria-hidden />
                    {t('friends.accept')}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    className="mt-4"
                    disabled={requestSent}
                    loading={sendRequest.isPending}
                    onClick={() =>
                      sendRequest.mutate(
                        { userId },
                        {
                          onSuccess: (result) => {
                            if (!result.accepted) setRequestSent(true);
                          },
                        },
                      )
                    }
                  >
                    <UserPlus size={16} aria-hidden />
                    {requestSent ? t('profile.requestSent') : t('profile.addFriend')}
                  </Button>
                )}
                <Button
                  fullWidth
                  variant="danger"
                  className="mt-2"
                  loading={block.isPending}
                  onClick={() => {
                    if (!window.confirm(t('settings.blockConfirm', { name: user.displayName ?? user.username }))) {
                      return;
                    }
                    block.mutate(userId, {
                      onSuccess: () => {
                        navigate(`/channels/${DM_ROUTE}`);
                        onClose();
                      },
                    });
                  }}
                >
                  <Ban size={16} aria-hidden />
                  {t('settings.blockUser')}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </AdaptiveDialog>
  );
}
