import { Check, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useAcceptFriendRequest, useDeclineFriendRequest, useIncomingFriendRequests } from '@/hooks/useFriends';
import { useFriends } from '@/hooks/useFriends';
import { useCreateConversation } from '@/hooks/useDms';
import { useNavigate } from 'react-router-dom';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { useUiStore } from '@/stores/uiStore';

export function IncomingFriendsList() {
  const t = useT();
  const { data, isLoading } = useIncomingFriendRequests();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-text-muted">{t('friends.emptyIncoming')}</p>;
  }

  return (
    <ul className="flex flex-col gap-1 px-2">
      {data.map((request) => (
        <li
          key={request.id}
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-hover"
        >
          <Avatar user={request.from} size={40} showStatus />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-medium text-text-heading">
              {request.from.displayName ?? request.from.username}
            </span>
            <span className="truncate text-sm text-text-muted">@{request.from.username}</span>
          </span>
          <IconButton
            icon={X}
            label={t('friends.decline')}
            size="md"
            tone="danger"
            onClick={() => decline.mutate(request.id)}
          />
          <IconButton
            icon={Check}
            label={t('friends.accept')}
            size="md"
            className="text-success hover:text-success"
            onClick={() => accept.mutate(request.id)}
          />
        </li>
      ))}
    </ul>
  );
}

export function IncomingFriendsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <AdaptiveDialog open={open} onClose={onClose} title={t('friends.incomingTitle')} width="md">
      <IncomingFriendsList />
    </AdaptiveDialog>
  );
}

export function MobileFriendsView() {
  const t = useT();
  const popMobileView = useUiStore((state) => state.popMobileView);
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const navigate = useNavigate();
  const { data: friends } = useFriends();
  const create = useCreateConversation();
  return (
    <div className="flex h-full flex-col bg-surface-secondary">
      <MobileHeader title={t('friends.title')} onBack={popMobileView} />
      <div className="scroller flex-1">
        <p className="px-4 pb-2 pt-4 text-xs font-semibold uppercase text-text-muted">
          {t('friends.title')} · {friends?.length ?? 0}
        </p>
        <ul className="px-2">
          {friends?.map((friend) => (
            <li key={friend.id}>
              <button
                type="button"
                onClick={() =>
                  create.mutate(
                    { userIds: [friend.id] },
                    {
                      onSuccess: (conversation) => {
                        navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
                        pushMobileView('chat');
                      },
                    },
                  )
                }
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left active:bg-surface-hover"
              >
                <Avatar user={friend} size={40} showStatus />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-text-heading">
                    {friend.displayName ?? friend.username}
                  </span>
                  <span className="block truncate text-sm text-text-muted">@{friend.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-4 pb-2 pt-6 text-xs font-semibold uppercase text-text-muted">
          {t('friends.incomingTitle')}
        </p>
        <IncomingFriendsList />
      </div>
    </div>
  );
}
