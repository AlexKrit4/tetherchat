import { useState } from 'react';
import { LockKeyhole, MessageCircle, UserPlus } from 'lucide-react';
import type { DirectConversation } from '@tetherchat/shared';
import { useMutation } from '@tanstack/react-query';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { useFriends } from '@/hooks/useFriends';
import { useCreateConversation } from '@/hooks/useDms';
import { useAuthStore } from '@/stores/authStore';
import { createSecretConversation } from '@/lib/e2ee';
import { FriendRequestDialog } from './FriendRequestDialog';

export function CreateChatDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (conversation: DirectConversation) => void;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const { data: friends, isLoading } = useFriends();
  const regular = useCreateConversation();
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secret = useMutation({
    mutationFn: async (friendId: string) => {
      if (!userId) throw new Error('Войдите снова');
      return createSecretConversation(userId, friendId);
    },
  });

  const finish = (conversation: DirectConversation) => {
    setError(null);
    onCreated(conversation);
    onClose();
  };

  return (
    <>
      <AdaptiveDialog open={open} onClose={onClose} title="Новый чат" width="md">
        <button
          type="button"
          onClick={() => setAddFriendOpen(true)}
          className="mb-3 flex w-full items-center gap-3 rounded-lg bg-surface-active px-3 py-3 text-sm font-medium text-text-heading"
        >
          <UserPlus size={19} className="text-brand" />
          Добавить друга
        </button>
        <p className="mb-2 px-1 text-xs text-text-muted">
          Выберите обычный чат или секретный чат с end-to-end шифрованием.
        </p>
        {error ? <p className="mb-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <ul className="max-h-[55vh] overflow-y-auto">
            {friends?.map((friend) => (
              <li key={friend.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-hover">
                <Avatar user={friend} size={40} showStatus />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text-heading">
                    {friend.displayName ?? friend.username}
                  </span>
                  <span className="block truncate text-sm text-text-muted">@{friend.username}</span>
                </span>
                <IconButton
                  icon={MessageCircle}
                  label="Обычный чат"
                  onClick={() =>
                    regular.mutate(
                      { userIds: [friend.id] },
                      { onSuccess: finish, onError: (reason) => setError((reason as Error).message) },
                    )
                  }
                />
                <IconButton
                  icon={LockKeyhole}
                  label="Секретный чат"
                  className="text-success"
                  onClick={() =>
                    secret.mutate(friend.id, {
                      onSuccess: finish,
                      onError: (reason) => setError((reason as Error).message),
                    })
                  }
                />
              </li>
            ))}
            {friends?.length === 0 ? (
              <li className="py-8 text-center text-sm text-text-muted">Сначала добавьте друга.</li>
            ) : null}
          </ul>
        )}
      </AdaptiveDialog>
      <FriendRequestDialog open={addFriendOpen} onClose={() => setAddFriendOpen(false)} />
    </>
  );
}
