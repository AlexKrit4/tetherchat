import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useGlobalSearch, useMessageSearch } from '@/hooks/useMessages';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { messageTimestamp } from '@/lib/time';
import { MessageContent } from './MessageContent';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/cn';
import type { Message, SearchHit } from '@tetherchat/shared';
import { DM_ROUTE } from '@/hooks/useChatTarget';

/** Ctrl/Cmd+F opens this over the channel; on mobile it becomes a sheet. */
export function SearchPanel() {
  const t = useT();
  const navigate = useNavigate();
  const open = useUiStore((state) => state.searchOpen);
  const setOpen = useUiStore((state) => state.setSearchOpen);
  const setHighlight = useUiStore((state) => state.setHighlightMessage);
  const { channelId, isDm, title } = useChatTarget();
  const [term, setTerm] = useState('');
  const [everywhere, setEverywhere] = useState(true);
  const debounced = useDebounced(term, 250);
  const local = useMessageSearch(everywhere ? undefined : channelId, debounced, isDm);
  const global = useGlobalSearch(everywhere ? debounced : '');
  const isFetching = everywhere ? global.isFetching : local.isFetching;

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

  const jump = (message: Message, _dm: boolean) => {
    setHighlight(message.id);
    setOpen(false);
    const path = message.serverId
      ? `/channels/${message.serverId}/${message.channelId}`
      : `/channels/${DM_ROUTE}/${message.channelId}`;
    if (message.channelId !== channelId) navigate(path);
  };

  const localResults = local.data ?? [];
  const globalResults = global.data ?? [];

  return (
    <AdaptiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title={everywhere ? t('chat.searchEverywhere') : isDm ? t('chat.searchTitleDm', { name: title }) : t('chat.searchTitleChannel', { name: title })}
      width="md"
    >
      <Input
        autoFocus
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t('chat.searchMessages')}
        aria-label={t('chat.searchMessages')}
      />
      <div className="mt-2 flex gap-1">
        <ScopeChip active={everywhere} onClick={() => setEverywhere(true)} label={t('chat.searchAll')} />
        <ScopeChip active={!everywhere} onClick={() => setEverywhere(false)} label={t('chat.searchHere')} />
      </div>

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
        ) : everywhere ? (
          globalResults.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {globalResults.map((hit) => (
                <SearchHitRow key={hit.message.id} hit={hit} onJump={jump} />
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-base text-text-muted">{t('chat.searchEmpty')}</p>
          )
        ) : localResults.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {localResults.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => jump(message, isDm)}
                  className="w-full rounded-lg bg-surface-secondary p-3 text-left hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2">
                    <Avatar user={message.author} size={22} />
                    <span className="text-base font-medium text-text-heading">
                      {message.author.displayName ?? message.author.username}
                    </span>
                    <span className="text-xs text-text-muted">{messageTimestamp(message.createdAt)}</span>
                  </div>
                  <div className="mt-1">
                    <MessageContent content={message.content} />
                  </div>
                </button>
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

function SearchHitRow({
  hit,
  onJump,
}: {
  hit: SearchHit;
  onJump: (message: Message, dm: boolean) => void;
}) {
  const t = useT();
  const matchLabel =
    hit.match === 'file' ? t('chat.searchMatchFile') : hit.match === 'link' ? t('chat.searchMatchLink') : null;
  return (
    <li>
      <button
        type="button"
        onClick={() => onJump(hit.message, hit.isDm)}
        className="w-full rounded-lg bg-surface-secondary p-3 text-left hover:bg-surface-hover"
      >
        <p className="text-xs text-text-muted">
          {hit.contextTitle}
          {matchLabel ? ` · ${matchLabel}` : ''}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Avatar user={hit.message.author} size={22} />
          <span className="text-base font-medium text-text-heading">
            {hit.message.author.displayName ?? hit.message.author.username}
          </span>
          <span className="text-xs text-text-muted">{messageTimestamp(hit.message.createdAt)}</span>
        </div>
        <div className="mt-1">
          <MessageContent content={hit.message.content} />
        </div>
      </button>
    </li>
  );
}

function ScopeChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        active ? 'bg-brand text-white' : 'bg-surface-secondary text-text-muted',
      )}
    >
      {label}
    </button>
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
