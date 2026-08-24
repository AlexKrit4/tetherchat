import { ChatArea } from '@/components/chat/ChatArea';

/** The chat column fills the screen on phones; ChatArea already adapts itself. */
export function MobileChatView() {
  return <ChatArea className="h-full" />;
}
