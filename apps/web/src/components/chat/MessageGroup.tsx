import { memo, useState } from 'react';
import { CornerUpLeft, Pencil, Pin, Reply, SmilePlus, Trash2 } from 'lucide-react';
import type { Message, ServerMember } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { messageTimestamp, shortTime } from '@/lib/time';
import { useHasHover, useIsMobile } from '@/hooks/useMediaQuery';
import { useLongPress } from '@/hooks/useLongPress';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { MessageContent } from './MessageContent';
import { Attachments, LinkPreviews } from './Attachments';
import { Reactions } from './Reactions';
import { MessageEditor } from './MessageEditor';

export interface MessageActionSet {
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canReact: boolean;
}

export interface MessageGroupProps {
  message: Message;
  isGroupStart: boolean;
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
}

/**
 * One message row. The first message of a group carries the avatar and the
 * author header; the rest are indented to line up with the text above, which is
 * what gives a Discord channel its dense rhythm.
 */
export const MessageGroup = memo(function MessageGroup({
  message,
  isGroupStart,
  member,
  roleColor,
  actions,
  editing,
  mentionsMe,
  onReply,
  onEdit,
  onEditSubmit,
  onEditCancel,
  onDelete,
  onTogglePin,
  onToggleReaction,
  onOpenEmojiPicker,
  onOpenActions,
  onOpenProfile,
  onJumpToMessage,
}: MessageGroupProps) {
  const isMobile = useIsMobile();
  const hasHover = useHasHover();
  const [hovered, setHovered] = useState(false);

  const longPress = useLongPress(() => onOpenActions(message), { enabled: isMobile });

  const displayName = member?.nickname ?? message.author.displayName ?? message.author.username;
  const avatarSize = isMobile ? 32 : 40;
  // Avatar column plus the 16px gap, so quoted replies line up with the body text.
  const textIndent = isMobile ? 'pl-[48px]' : 'pl-[56px]';

  if (message.system) {
    return (
      <div className="px-4 py-1 text-sm text-text-muted md:px-4">
        <span className="font-medium text-text-subheading">{displayName}</span> {message.content}
      </div>
    );
  }

  return (
    <div
      {...longPress}
      onMouseEnter={hasHover ? () => setHovered(true) : undefined}
      onMouseLeave={hasHover ? () => setHovered(false) : undefined}
      className={cn(
        'group/message relative px-4 md:px-4',
        isGroupStart ? 'mt-4 first:mt-0' : 'mt-0.5',
        mentionsMe && 'bg-mention-bg',
        hovered && !mentionsMe && 'md:bg-[rgba(2,2,2,0.06)]',
        message.failed && 'opacity-70',
      )}
    >
      {mentionsMe ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-mention-text" />
      ) : null}

      {message.replyTo ? (
        <button
          type="button"
          onClick={() => message.replyTo && onJumpToMessage?.(message.replyTo.id)}
          className={cn(
            'mb-1 flex w-full items-center gap-1.5 text-left text-sm text-text-muted',
            textIndent,
          )}
        >
          <CornerUpLeft size={14} className="shrink-0 text-text-faint" aria-hidden />
          <span className="shrink-0 font-medium text-text-subheading">
            @{message.replyTo.author?.displayName ?? message.replyTo.author?.username ?? 'unknown'}
          </span>
          <span className="truncate opacity-80">
            {message.replyTo.deleted ? 'Original message was deleted' : message.replyTo.content}
          </span>
        </button>
      ) : null}

      <div className="flex gap-4">
        {isGroupStart ? (
          <button
            type="button"
            onClick={() => onOpenProfile(message.authorId)}
            // self-start keeps the avatar at the top of a tall group instead of
            // letting the button stretch and centre it.
            className="mt-0.5 shrink-0 self-start"
            aria-label={`Open ${displayName} profile`}
          >
            <Avatar user={message.author} size={avatarSize} />
          </button>
        ) : (
          <span
            aria-hidden
            className="shrink-0 select-none pt-0.5 text-right text-2xs leading-[22px] text-text-faint opacity-0 group-hover/message:opacity-100"
            style={{ width: avatarSize }}
          >
            {hasHover ? shortTime(message.createdAt) : ''}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {isGroupStart ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <button
                type="button"
                onClick={() => onOpenProfile(message.authorId)}
                className="text-message font-medium hover:underline"
                style={{ color: roleColor ?? 'var(--header-primary)' }}
              >
                {displayName}
              </button>
              <Tooltip content={messageTimestamp(message.createdAt)}>
                <span className="text-xs text-text-muted">{messageTimestamp(message.createdAt)}</span>
              </Tooltip>
            </div>
          ) : null}

          {editing ? (
            <MessageEditor
              initialValue={message.content}
              onSubmit={onEditSubmit}
              onCancel={onEditCancel}
            />
          ) : (
            <>
              {message.content ? (
                <div className="flex flex-wrap items-baseline gap-1">
                  <MessageContent content={message.content} />
                  {message.editedAt ? (
                    <Tooltip content={messageTimestamp(message.editedAt)}>
                      <span className="text-2xs text-text-faint">(edited)</span>
                    </Tooltip>
                  ) : null}
                  {message.pending ? (
                    <span className="text-2xs text-text-faint">Sending…</span>
                  ) : null}
                  {message.failed ? (
                    <span className="text-2xs text-danger">Failed to send</span>
                  ) : null}
                </div>
              ) : null}

              <Attachments attachments={message.attachments} />
              <LinkPreviews previews={message.previews} />

              <Reactions
                reactions={message.reactions}
                onToggle={onToggleReaction}
                onAdd={onOpenEmojiPicker}
                disabled={!actions.canReact}
              />
            </>
          )}
        </div>
      </div>

      {/* Hover toolbar is desktop-only: touch devices use long-press instead. */}
      {hasHover && hovered && !editing ? (
        <div className="absolute -top-4 right-4 z-10 flex items-center gap-0.5 rounded bg-surface-secondary p-0.5 shadow-elevated">
          {actions.canReact ? (
            <IconButton icon={SmilePlus} label="Add reaction" size="sm" onClick={onOpenEmojiPicker} />
          ) : null}
          <IconButton icon={Reply} label="Reply" size="sm" onClick={() => onReply(message)} />
          {actions.canEdit ? (
            <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => onEdit(message)} />
          ) : null}
          {actions.canPin ? (
            <IconButton
              icon={Pin}
              label={message.pinned ? 'Unpin' : 'Pin'}
              size="sm"
              active={message.pinned}
              onClick={() => onTogglePin(message)}
            />
          ) : null}
          {actions.canDelete ? (
            <IconButton
              icon={Trash2}
              label="Delete"
              size="sm"
              tone="danger"
              onClick={() => onDelete(message)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
