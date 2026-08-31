import { useEffect, useState } from 'react';
import { LockKeyhole, UserPlus } from 'lucide-react';
import type { DirectConversation } from '@tetherchat/shared';
import { useMutation } from '@tanstack/react-query';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useFriends } from '@/hooks/useFriends';
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
  const [mode, setMode] = useState<'choice' | 'secret'>('choice');
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secret = useMutation({
    mutationFn: async (friendId: string) => {
      if (!userId) throw new Error('Войдите снова');
      return createSecretConversation(userId, friendId);
    },
  });
  useEffect(() => {
    if (open) {
      setMode('choice');
      setError(null);
    }
  }, [open]);

  const finish = (conversation: DirectConversation) => {
    setError(null);
    onCreated(conversation);
    onClose();
  };

  return (
    <>
      <AdaptiveDialog
        open={open}
        onClose={onClose}
        title={mode === 'choice' ? 'Что вы хотите сделать?' : 'Секретный чат'}
        width="md"
      >
        {error ? <p className="mb-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        {mode === 'choice' ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setAddFriendOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl bg-surface-active px-4 py-4 text-left font-medium text-text-heading"
            >
              <UserPlus size={21} className="text-brand" />
              Пригласить в друзья
            </button>
            <button
              type="button"
              onClick={() => setMode('secret')}
              className="flex w-full items-center gap-3 rounded-xl bg-surface-active px-4 py-4 text-left font-medium text-text-heading"
            >
              <LockKeyhole size={21} className="text-success" />
              Создать секретный чат
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <>
            <p className="mb-2 text-xs text-text-muted">Выберите друга для нового E2EE-чата.</p>
            <ul className="max-h-[55vh] overflow-y-auto">
            {friends?.map((friend) => (
              <li key={friend.id}>
                <button
                  type="button"
                  onClick={() =>
                    secret.mutate(friend.id, {
                      onSuccess: finish,
                      onError: (reason) => setError((reason as Error).message),
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-hover"
                >
                  <Avatar user={friend} size={40} showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-text-heading">
                      {friend.displayName ?? friend.username}
                    </span>
                    <span className="block truncate text-sm text-text-muted">@{friend.username}</span>
                  </span>
                  <LockKeyhole size={18} className="text-success" />
                </button>
              </li>
            ))}
            {friends?.length === 0 ? (
              <li className="py-8 text-center text-sm text-text-muted">Сначала добавьте друга.</li>
            ) : null}
            </ul>
            <button type="button" onClick={() => setMode('choice')} className="mt-3 text-sm text-brand">
              Назад
            </button>
          </>
        )}
      </AdaptiveDialog>
      <FriendRequestDialog open={addFriendOpen} onClose={() => setAddFriendOpen(false)} />
    </>
  );
}
