import { useEffect } from 'react';
import { useConversations } from '@/hooks/useDms';
import { useReadStates } from '@/hooks/useReadStates';
import { useAuthStore } from '@/stores/authStore';

function setBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (value: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (typeof nav.setAppBadge !== 'function') return;
  if (count <= 0) void nav.clearAppBadge?.();
  else void nav.setAppBadge(count);
}

/** Launcher / home-screen badge is an unread count, not a nameless dot. */
export function useAppBadge(): void {
  const status = useAuthStore((state) => state.status);
  const { data: readStates } = useReadStates();
  const { data: conversations } = useConversations();

  useEffect(() => {
    if (status !== 'authenticated') {
      setBadge(0);
      return;
    }
    const channelUnread = (readStates ?? []).filter((state) => state.unread).length;
    const dmUnread = (conversations ?? []).filter((conversation) => {
      if (!conversation.lastMessageAt) return false;
      if (!conversation.selfLastReadAt) return true;
      return conversation.lastMessageAt > conversation.selfLastReadAt;
    }).length;
    setBadge(channelUnread + dmUnread);
  }, [conversations, readStates, status]);
}
