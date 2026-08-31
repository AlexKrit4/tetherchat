import { cn } from '@/lib/cn';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import { MediaPanel } from './MediaPanel';
import { SearchPanel } from './SearchPanel';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useChannelNotificationSetting } from '@/hooks/useReadStates';

/**
 * Header, history and composer. On mobile the whole column is shifted up by the
 * keyboard height so the composer stays visible while typing.
 */
export function ChatArea({ className }: { className?: string }) {
  const isMobile = useIsMobile();
  const { offset } = useMobileKeyboard();
  const { isDm, conversation, channelId } = useChatTarget();
  const channelNotif = useChannelNotificationSetting(!isDm ? channelId : undefined);
  const wallpaper = isDm ? conversation?.wallpaperUrl : channelNotif.data?.wallpaperUrl;

  return (
    <main
      className={cn('relative flex min-w-0 flex-1 flex-col bg-surface', className)}
      style={isMobile && offset > 0 ? { paddingBottom: offset } : undefined}
    >
      {wallpaper ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatHeader />
        <div className="relative min-h-0 flex-1">
          <MessageList />
          <MessageInput />
        </div>
        <PinnedMessagesPanel />
        <SearchPanel />
        <MediaPanel />
      </div>
    </main>
  );
}
