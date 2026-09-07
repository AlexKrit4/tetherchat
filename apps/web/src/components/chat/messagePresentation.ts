import type { HTMLAttributes } from 'react';
import type { Message } from '@tetherchat/shared';

export interface MessageActionSet {
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canReact: boolean;
}

export type MessageReceipt = 'delivered' | 'read' | null;

/**
 * Everything a message layout needs to render one message.
 *
 * A layout is presentation only: it decides where the avatar, author, body,
 * timestamp and actions sit, and nothing else. Permissions, mutations, hover
 * and long-press state are resolved once in MessageGroup and handed down, so
 * adding a layout cannot fork the behaviour — only the shape.
 */
/**
 * Hover and long-press wiring for the message's outermost element.
 *
 * Spread by the layout onto its own root rather than applied by MessageGroup to
 * a wrapper: one node per message matters in a virtualized list, and a wrapper
 * would also sit between the message and any theme CSS written against it.
 */
export type MessageContainerProps = HTMLAttributes<HTMLDivElement> & {
  'data-mine'?: 'true';
};

export interface MessagePresentationProps {
  container: MessageContainerProps;
  message: Message;
  /** Carries the avatar and author header. */
  isGroupStart: boolean;
  /** Carries the tail and, in bubble layouts, the timestamp. */
  isGroupEnd: boolean;
  /** Written by the reader, so it is aligned and coloured as outgoing. */
  mine: boolean;
  /** Nickname if the server has one, otherwise display name or username. */
  displayName: string;
  roleColor: string | null;
  avatarSize: number;
  mentionsMe: boolean;
  editing: boolean;
  hovered: boolean;
  hasHover: boolean;
  isMobile: boolean;
  actions: MessageActionSet;
  receipt?: MessageReceipt;

  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onEditSubmit: (content: string) => void;
  onEditCancel: () => void;
  onDelete: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onToggleReaction: (emoji: string) => void;
  onOpenEmojiPicker: () => void;
  onOpenProfile: (userId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onForward?: (message: Message) => void;
  onReport?: (message: Message) => void;
  onOpenThread?: (message: Message) => void;
  onRetry?: (message: Message) => void;
  onToggleSelect?: (message: Message) => void;
  selected?: boolean;
  seenByCount?: number;
}
