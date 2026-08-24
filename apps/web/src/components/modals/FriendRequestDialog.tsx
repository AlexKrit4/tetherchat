import { useEffect, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import type { PublicUser } from '@tetherchat/shared';
import { useT } from '@/i18n/useT';
import { useSendFriendRequest, useFriends } from '@/hooks/useFriends';
import { useUserSearch } from '@/hooks/useDms';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

export function FriendRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const send = useSendFriendRequest();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<PublicUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setPicked(null);
    }
  }, [open]);

  const { data: friends } = useFriends();
  const { data: results, isFetching } = useUserSearch(debounced);
  const visibleResults = (results ?? []).filter(
    (user) => !friends?.some((friend) => friend.id === user.id),
  );

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title={t('friends.sendRequest')}
      description={t('friends.sendRequestHint')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={send.isPending}
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              send.mutate({ userId: picked.id }, { onSuccess: () => onClose() });
            }}
          >
            {t('friends.sendRequest')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          label={t('dm.findPeople')}
          autoFocus
          value={term}
          placeholder={t('dm.usernamePlaceholder')}
          onChange={(event) => {
            setTerm(event.target.value);
            setPicked(null);
          }}
        />
        <div className="min-h-[120px]">
          {isFetching ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : debounced.trim().length < 2 ? (
            <p className="py-6 text-center text-sm text-text-muted">{t('dm.searchHintShort')}</p>
          ) : visibleResults.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {visibleResults.map((user) => {
                const selected = picked?.id === user.id;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(user)}
                      className="flex min-h-12 w-full items-center gap-3 rounded px-2 text-left hover:bg-surface-hover md:min-h-11"
                    >
                      <Avatar user={user} size={32} showStatus />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base text-text-heading">
                          {user.displayName ?? user.username}
                        </span>
                        <span className="truncate text-sm text-text-muted">@{user.username}</span>
                      </span>
                      <span
                        className={
                          selected
                            ? 'flex h-5 w-5 items-center justify-center rounded bg-brand text-white'
                            : 'flex h-5 w-5 items-center justify-center rounded bg-surface-tertiary text-text-muted'
                        }
                      >
                        {selected ? <Check size={14} aria-hidden /> : <UserPlus size={14} aria-hidden />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">{t('dm.nobodyMatched')}</p>
          )}
        </div>
      </div>
    </AdaptiveDialog>
  );
}
