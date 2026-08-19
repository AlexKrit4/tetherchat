import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { LIMITS } from '@tetherchat/shared';
import type { PublicUser } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useCreateConversation, useUserSearch } from '@/hooks/useDms';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

/** Pick one person for a DM or several for a group conversation. */
export function NewConversationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const create = useCreateConversation();

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<PublicUser[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setSelected([]);
    }
  }, [open]);

  const { data: results, isFetching } = useUserSearch(debounced);
  const selectedIds = useMemo(() => new Set(selected.map((user) => user.id)), [selected]);
  const limitReached = selected.length >= LIMITS.groupDmMembers - 1;

  const submit = () => {
    if (selected.length === 0) return;
    create.mutate(
      { userIds: selected.map((user) => user.id) },
      {
        onSuccess: (conversation) => {
          navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
          if (isMobile) pushMobileView('chat');
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title={t('dm.newConversation')}
      description={t('dm.newConversationDescription', { max: LIMITS.groupDmMembers - 1 })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={create.isPending} disabled={selected.length === 0} onClick={submit}>
            {selected.length > 1 ? t('dm.createGroup') : t('dm.openConversation')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {selected.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {selected.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => setSelected((current) => current.filter((entry) => entry.id !== user.id))}
                  className="flex min-h-8 items-center gap-1.5 rounded bg-surface-tertiary px-2 text-sm text-text"
                >
                  {user.displayName ?? user.username}
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <Input
          label={t('dm.findPeople')}
          autoFocus
          value={term}
          placeholder={t('dm.usernamePlaceholder')}
          onChange={(event) => setTerm(event.target.value)}
        />

        <div className="min-h-[120px]">
          {isFetching ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : debounced.trim().length < 2 ? (
            <p className="py-6 text-center text-sm text-text-muted">{t('dm.searchHintShort')}</p>
          ) : results && results.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {results.map((user) => {
                const picked = selectedIds.has(user.id);
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      disabled={!picked && limitReached}
                      onClick={() =>
                        setSelected((current) =>
                          picked
                            ? current.filter((entry) => entry.id !== user.id)
                            : [...current, user],
                        )
                      }
                      className={cn(
                        'flex min-h-12 w-full items-center gap-3 rounded px-2 text-left md:min-h-11',
                        'hover:bg-surface-hover disabled:opacity-40',
                      )}
                    >
                      <Avatar user={user} size={32} showStatus />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base text-text-heading">
                          {user.displayName ?? user.username}
                        </span>
                        <span className="truncate text-sm text-text-muted">@{user.username}</span>
                      </span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                          picked ? 'bg-brand text-white' : 'bg-surface-tertiary',
                        )}
                      >
                        {picked ? <Check size={14} aria-hidden /> : null}
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
