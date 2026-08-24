import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMessageSearch } from '@/hooks/useMessages';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { messageTimestamp } from '@/lib/time';
import { MessageContent } from './MessageContent';
import { useUiStore } from '@/stores/uiStore';

/** Ctrl/Cmd+F opens this over the channel; on mobile it becomes a sheet. */
export function SearchPanel() {
  const t = useT();
  const open = useUiStore((state) => state.searchOpen);
  const setOpen = useUiStore((state) => state.setSearchOpen);
  const { channelId, isDm, title } = useChatTarget();
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 250);
  const { data: results, isFetching } = useMessageSearch(channelId, debounced, isDm);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setTerm('');
  }, [open]);

  return (
    <AdaptiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title={isDm ? t('chat.searchTitleDm', { name: title }) : t('chat.searchTitleChannel', { name: title })}
      width="md"
    >
      <Input
        autoFocus
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t('chat.searchMessages')}
        aria-label={t('chat.searchMessages')}
      />

      <div className="mt-3">
        {isFetching ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : debounced.trim().length < 2 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Search size={30} className="text-text-faint" aria-hidden />
            <p className="text-base text-text-muted">{t('chat.searchHint')}</p>
          </div>
        ) : results && results.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {results.map((message) => (
              <li key={message.id} className="rounded-lg bg-surface-secondary p-3">
                <div className="flex items-center gap-2">
                  <Avatar user={message.author} size={22} />
                  <span className="text-base font-medium text-text-heading">
                    {message.author.displayName ?? message.author.username}
                  </span>
                  <span className="text-xs text-text-muted">
                    {messageTimestamp(message.createdAt)}
                  </span>
                </div>
                <div className="mt-1">
                  <MessageContent content={message.content} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-base text-text-muted">{t('chat.searchEmpty')}</p>
        )}
      </div>
    </AdaptiveDialog>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}
