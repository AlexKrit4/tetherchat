import { Check, CheckCheck, CornerUpLeft, Forward } from 'lucide-react';
import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { useSwipeReply } from '@/hooks/useSwipeReply';
import { useT } from '@/i18n/useT';
import { messageTimestamp, shortTime } from '@/lib/time';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { DisplayName } from '@/components/plus/DisplayName';
import { MessageContent } from './MessageContent';
import { Attachments, LinkPreviews } from './Attachments';
import { Reactions } from './Reactions';
import { MessageEditor } from './MessageEditor';
import { MessageToolbar } from './MessageToolbar';
import type { MessagePresentationProps, MessageReceipt } from './messagePresentation';

/**
 * Full-width rows in the shape of a Discord channel: the first message of a run
 * carries the avatar and author header and the rest are indented to line up
 * with the text above it, which is what produces the dense rhythm.
 */
export function MessageRow({
  container,
  message,
  isGroupStart,
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
  onReply,
  onEdit,
  onEditSubmit,
  onEditCancel,
  onDelete,
  onTogglePin,
  onToggleReaction,
  onOpenEmojiPicker,
  onOpenProfile,
  onJumpToMessage,
  onForward,
  onReport,
  onOpenThread,
  onRetry,
  selected,
  seenByCount,
}: MessagePresentationProps) {
  const t = useT();
  const reply = useCallback(() => onReply(message), [message, onReply]);
  const swipeReply = useSwipeReply(reply, isMobile && !editing);
  // Avatar column plus the 16px gap, so quoted replies line up with the body.
  const textIndent = isMobile ? 'pl-[48px]' : 'pl-[56px]';

  return (
    <div
      {...container}
      className={cn(
        'group/message relative px-4 md:px-4',
        isGroupStart ? 'mt-4 first:mt-0' : isMobile ? 'mt-0' : 'mt-0.5',
        mentionsMe && 'bg-mention-bg',
        hovered && !mentionsMe && 'md:bg-[rgba(2,2,2,0.06)]',
        message.failed && 'opacity-70',
        selected && 'bg-surface-accent/40',
      )}
      onClick={message.failed && onRetry ? () => onRetry(message) : undefined}
      role={message.failed ? 'button' : undefined}
    >
      {mentionsMe ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-mention-text" />
      ) : null}

      {message.forwardedFrom ? (
        <div className={cn('mb-1 flex items-center gap-1.5 text-sm text-text-muted', textIndent)}>
          <Forward size={14} className="shrink-0 text-text-faint" aria-hidden />
          <span className="truncate">
            {t('chat.forwardedFrom', {
              name:
                message.forwardedFrom.author?.displayName ??
                message.forwardedFrom.author?.username ??
                t('common.unknown'),
            })}
          </span>
        </div>
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
            @
            {message.replyTo.author?.displayName ??
              message.replyTo.author?.username ??
              t('common.unknown')}
          </span>
          <span className="truncate opacity-80">
            {message.replyTo.deleted ? t('chat.originalDeleted') : message.replyTo.content}
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
            aria-label={t('chat.openProfile', { name: displayName })}
          >
            <Avatar user={message.author} size={avatarSize} />
          </button>
        ) : isMobile ? null : (
          <span
            aria-hidden
            className="shrink-0 select-none pt-0.5 text-right text-2xs leading-[22px] text-text-faint opacity-0 group-hover/message:opacity-100"
            style={{ width: avatarSize }}
          >
            {hasHover ? shortTime(message.createdAt) : ''}
          </span>
        )}

        <div className={cn('min-w-0 flex-1', !isGroupStart && isMobile && textIndent)} {...(isMobile ? swipeReply : {})}>
          {isGroupStart ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <button
                type="button"
                onClick={() => onOpenProfile(message.authorId)}
                className="text-message font-medium hover:underline"
              >
                <DisplayName
                  user={message.author}
                  name={displayName}
                  color={roleColor ?? 'var(--header-primary)'}
                />
              </button>
              <Tooltip content={messageTimestamp(message.createdAt)}>
                <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                  {messageTimestamp(message.createdAt)}
                  <ReceiptMark receipt={receipt} />
                </span>
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
                      <span className="text-2xs text-text-faint">{t('chat.edited')}</span>
                    </Tooltip>
                  ) : null}
                  {message.pending ? (
                    <span className="text-2xs text-text-faint">{t('chat.sending')}</span>
                  ) : null}
                  {message.failed ? (
                    <span className="text-2xs text-danger">{t('chat.retrySend')}</span>
                  ) : null}
                  {!isGroupStart ? <ReceiptMark receipt={receipt} /> : null}
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
              {(message.threadReplyCount ?? 0) > 0 && onOpenThread ? (
                <button
                  type="button"
                  onClick={() => onOpenThread(message)}
                  className="mt-1 text-xs font-medium text-text-link hover:underline"
                >
                  {t('chat.threadReplies', { count: message.threadReplyCount ?? 0 })}
                </button>
              ) : null}
              {typeof seenByCount === 'number' && seenByCount > 0 ? (
                <p className="mt-0.5 text-2xs text-text-muted">{t('chat.seenBy', { count: seenByCount })}</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {hasHover && hovered && !editing ? (
        <MessageToolbar
          message={message}
          actions={actions}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          onOpenEmojiPicker={onOpenEmojiPicker}
          onForward={onForward}
          onReport={onReport}
          onOpenThread={onOpenThread}
          className="absolute -top-4 right-4"
        />
      ) : null}
    </div>
  );
}

function ReceiptMark({ receipt }: { receipt?: MessageReceipt }) {
  if (!receipt) return null;
  const Icon = receipt === 'read' ? CheckCheck : Check;
  return (
    <Icon size={14} className={receipt === 'read' ? 'text-brand' : 'text-text-faint'} aria-hidden />
  );
}
