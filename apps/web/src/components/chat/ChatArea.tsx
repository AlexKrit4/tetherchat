import { cn } from '@/lib/cn';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import { SearchPanel } from './SearchPanel';

/**
 * Header, history and composer. On mobile the whole column is shifted up by the
 * keyboard height so the composer stays visible while typing.
 */
export function ChatArea({ className }: { className?: string }) {
  const isMobile = useIsMobile();
  const { offset } = useMobileKeyboard();

  return (
    <main
      className={cn('flex min-w-0 flex-1 flex-col bg-surface', className)}
      style={isMobile && offset > 0 ? { paddingBottom: offset } : undefined}
    >
      <ChatHeader />
      <MessageList />
      <MessageInput />
      <PinnedMessagesPanel />
      <SearchPanel />
    </main>
  );
}
