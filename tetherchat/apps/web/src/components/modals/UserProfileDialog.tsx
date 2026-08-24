import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, MessageSquare } from 'lucide-react';
import type { PublicUser } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { memberSince } from '@/lib/time';
import { useT } from '@/i18n/useT';
import { DM_ROUTE, useChatTarget } from '@/hooks/useChatTarget';
import { useCreateConversation } from '@/hooks/useDms';
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
  const createConversation = useCreateConversation();
  const block = useBlockUser();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get<PublicUser>(`/api/users/${userId}`),
    enabled: open,
  });

  const member = members?.find((entry) => entry.userId === userId);
  const roles = (server?.roles ?? [])
    .filter((role) => !role.isDefault && member?.roleIds.includes(role.id))
    .sort((a, b) => b.position - a.position);

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
              {member?.nickname ?? user.displayName ?? user.username}
            </p>
            <p className="text-base text-text-muted">@{user.username}</p>

            {user.customStatus ? (
              <p className="mt-2 text-base text-text">{user.customStatus}</p>
            ) : null}

            {user.bio ? (
              <>
                <div className="my-3 h-px bg-divider" />
                <p className="text-xs font-bold uppercase tracking-[0.02em] text-text-subheading">
                  {t('profile.aboutMe')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-base text-text">{user.bio}</p>
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
              <Button
                fullWidth
                className="mt-4"
                loading={createConversation.isPending}
                onClick={() =>
                  createConversation.mutate(
                    { userIds: [userId] },
                    {
                      onSuccess: (conversation) => {
                        navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
                        if (isMobile) pushMobileView('chat');
                        onClose();
                      },
                      onError: (error) => toast.error(errorMessage(error)),
                    },
                  )
                }
              >
                <MessageSquare size={16} aria-hidden />
                {t('profile.sendDm')}
              </Button>
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
