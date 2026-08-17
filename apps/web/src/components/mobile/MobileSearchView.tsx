import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useMessageSearch } from '@/hooks/useMessages';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { MessageContent } from '@/components/chat/MessageContent';
import { messageTimestamp } from '@/lib/time';
import { MobileHeader } from './MobileHeader';
import { useUiStore } from '@/stores/uiStore';

/** Search gets its own screen on phones rather than a cramped overlay. */
export function MobileSearchView() {
  const popMobileView = useUiStore((state) => state.popMobileView);
  const { channelId, isDm, title } = useChatTarget();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const { data: results, isFetching } = useMessageSearch(channelId, debounced, isDm);

  return (
    <div className="flex h-full flex-col bg-surface">
      <MobileHeader title="Search" subtitle={isDm ? title : `#${title}`} onBack={popMobileView} />

      <div className="shrink-0 px-4 pb-3 pt-1">
        <input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search messages…"
          aria-label="Search messages"
          className="h-12 w-full rounded-lg bg-surface-tertiary px-3 text-base text-text outline-none placeholder:text-text-faint focus:shadow-[0_0_0_2px_var(--brand)]"
        />
      </div>

      <div className="scroller flex-1 px-4 pb-safe">
        {isFetching ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : debounced.trim().length < 2 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Search size={32} className="text-text-faint" aria-hidden />
            <p className="text-base text-text-muted">Type at least two characters.</p>
          </div>
        ) : results && results.length > 0 ? (
          <ul className="flex flex-col gap-2 pb-6">
            {results.map((message) => (
              <li key={message.id} className="rounded-lg bg-surface-secondary p-3">
                <div className="flex items-center gap-2">
                  <Avatar user={message.author} size={24} />
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
          <p className="py-12 text-center text-base text-text-muted">No messages matched.</p>
        )}
      </div>
    </div>
  );
}
