import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { DisplayName } from '@/components/plus/DisplayName';
import { Spinner } from '@/components/ui/Spinner';
import { useFriends } from '@/hooks/useFriends';
import { useCreateConversation } from '@/hooks/useDms';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useUiStore } from '@/stores/uiStore';
import { IncomingFriendsList } from './IncomingFriends';

export function FriendsHub() {
  const navigate = useNavigate();
  const { data: friends, isLoading } = useFriends();
  const create = useCreateConversation();
  const setFriendsOpen = useUiStore((state) => state.setFriendsRailOpen);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-header shrink-0 items-center border-b border-divider px-5">
        <h1 className="text-lg font-semibold text-text-heading">Друзья</h1>
      </header>
      <div className="scroller flex-1 px-3 py-4 md:px-6">
        <section className="mx-auto max-w-3xl">
          <h2 className="mb-2 text-xs font-semibold uppercase text-text-muted">
            Все друзья · {friends?.length ?? 0}
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <ul className="space-y-1">
              {friends?.map((friend) => (
                <li key={friend.id}>
                  <button
                    type="button"
                    onClick={() =>
                      create.mutate(
                        { userIds: [friend.id] },
                        {
                          onSuccess: (conversation) => {
                            setFriendsOpen(false);
                            navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
                          },
                        },
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-surface-hover"
                  >
                    <Avatar user={friend} size={44} showStatus />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-text-heading">
                        <DisplayName user={friend} name={friend.displayName ?? friend.username} />
                      </span>
                      <span className="block truncate text-sm text-text-muted">@{friend.username}</span>
                    </span>
                    <MessageCircle size={20} className="text-text-muted" aria-hidden />
                  </button>
                </li>
              ))}
              {friends?.length === 0 ? (
                <li className="py-8 text-center text-sm text-text-muted">Список друзей пока пуст.</li>
              ) : null}
            </ul>
          )}

          <h2 className="mb-2 mt-8 text-xs font-semibold uppercase text-text-muted">Входящие заявки</h2>
          <IncomingFriendsList />
        </section>
      </div>
    </main>
  );
}
