import { useState } from 'react';
import { MessagesSquare, SendHorizonal, X } from 'lucide-react';
import { LIMITS } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useNonce, useSendMessage, useThread } from '@/hooks/useMessages';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { MessageContent } from './MessageContent';
import { Attachments } from './Attachments';
import { useUiStore } from '@/stores/uiStore';
import { useT } from '@/i18n/useT';

export function ThreadPanel() {
  const t = useT();
  const isMobile = useIsMobile();
  const { channelId, isDm, conversation } = useChatTarget();
  const rootId = useUiStore((state) => state.threadRootId);
  const setThreadRoot = useUiStore((state) => state.setThreadRoot);
  const { data, isLoading } = useThread(rootId);
  const send = useSendMessage(channelId ?? '', isDm, Boolean(conversation?.isSecret));
  const nonce = useNonce();
  const [draft, setDraft] = useState('');

  if (!rootId) return null;

  const submit = () => {
    const content = draft.trim();
    if (!content || !channelId) return;
    if (content.length > LIMITS.messageContent.max) return;
    send.mutate({
      content,
      threadRootId: rootId,
      nonce: nonce(),
    });
    setDraft('');
  };

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-l border-divider bg-surface',
        isMobile ? 'absolute inset-0 z-30' : 'w-[360px] shrink-0',
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-divider px-3">
        <MessagesSquare size={16} className="text-text-muted" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-heading">
          {t('chat.thread')}
        </h2>
        <IconButton icon={X} label={t('common.close')} size="sm" onClick={() => setThreadRoot(null)} />
      </header>

      <div className="scroller min-h-0 flex-1 px-3 py-3">
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {[data.root, ...data.items].map((message) => (
              <li key={message.id} className={cn(message.id === data.root.id && 'rounded-md bg-surface-secondary p-2')}>
                <div className="flex items-center gap-2">
                  <Avatar user={message.author} size={22} />
                  <span className="text-sm font-medium text-text-heading">
                    {message.author.displayName ?? message.author.username}
                  </span>
                </div>
                {message.content ? (
                  <div className="mt-1 pl-7">
                    <MessageContent content={message.content} />
                  </div>
                ) : null}
                <div className="pl-7">
                  <Attachments attachments={message.attachments} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex shrink-0 items-end gap-2 border-t border-divider p-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('chat.threadReply')}
          rows={1}
          className={cn(
            'max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base text-text outline-none',
            isGraphite() ? 'rounded-md' : 'rounded',
          )}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <IconButton
          icon={SendHorizonal}
          label={t('chat.send')}
          size="sm"
          onClick={submit}
        />
      </form>
    </aside>
  );
}
