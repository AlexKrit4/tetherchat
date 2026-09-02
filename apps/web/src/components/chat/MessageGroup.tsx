import { memo, useState } from 'react';
import type { Message, ServerMember } from '@tetherchat/shared';
import { isGraphite } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useHasHover, useIsMobile } from '@/hooks/useMediaQuery';
import { useLongPress } from '@/hooks/useLongPress';
import { useAuthStore } from '@/stores/authStore';
import { MessageRow } from './MessageRow';
import { MessageBubble } from './MessageBubble';
import type {
  MessageActionSet,
  MessagePresentationProps,
  MessageReceipt,
} from './messagePresentation';

export type { MessageActionSet } from './messagePresentation';

export interface MessageGroupProps {
  message: Message;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  member: ServerMember | undefined;
  roleColor: string | null;
  actions: MessageActionSet;
  editing: boolean;
  mentionsMe: boolean;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onEditSubmit: (content: string) => void;
  onEditCancel: () => void;
  onDelete: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onToggleReaction: (emoji: string) => void;
  onOpenEmojiPicker: () => void;
  onOpenActions: (message: Message) => void;
  onOpenProfile: (userId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onForward?: (message: Message) => void;
  onReport?: (message: Message) => void;
  receipt?: MessageReceipt;
}

/**
 * One message, and the single place that decides how a message is shaped.
 *
 * Everything behavioural is resolved here — who wrote it, whether the pointer
 * is over it, how a long press is handled — and handed to a layout that only
 * arranges it. Rows and bubbles cannot be expressed as the same markup with
 * different variables, but they can share all of the logic, which is what keeps
 * a second look from becoming a second copy of the chat.
 */
export const MessageGroup = memo(function MessageGroup({
  message,
  isGroupStart,
  isGroupEnd,
  member,
  roleColor,
  actions,
  editing,
  mentionsMe,
  onOpenActions,
  receipt,
  ...handlers
}: MessageGroupProps) {
  const isMobile = useIsMobile();
  const hasHover = useHasHover();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const mine = message.authorId === currentUserId;
  const [hovered, setHovered] = useState(false);

  const longPress = useLongPress(() => onOpenActions(message), { enabled: isMobile });

  const displayName = member?.nickname ?? message.author.displayName ?? message.author.username;
  const avatarSize = isMobile ? 32 : 40;

  if (message.system) {
    return (
      <div
        className={cn(
          'text-sm text-text-muted',
          isGraphite() ? 'px-4 py-1.5 text-center' : 'px-4 py-1 md:px-4',
        )}
      >
        <span className="font-medium text-text-subheading">{displayName}</span> {message.content}
      </div>
    );
  }

  const presentation: MessagePresentationProps = {
    container: {
      ...longPress,
      'data-mine': mine ? 'true' : undefined,
      onMouseEnter: hasHover ? () => setHovered(true) : undefined,
      onMouseLeave: hasHover ? () => setHovered(false) : undefined,
    },
    message,
    isGroupStart,
    isGroupEnd,
    mine,
    displayName,
    roleColor,
    avatarSize,
    mentionsMe,
    editing,
    hovered,
    hasHover,
    isMobile,
    actions,
    receipt,
    ...handlers,
  };

  const Layout = isGraphite() ? MessageBubble : MessageRow;

  return <Layout {...presentation} />;
});
