import { Check, CheckCheck, Forward } from 'lucide-react';
import type { Message } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
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
 * Bubbles in the shape of a Telegram conversation: outgoing messages align
 * right on the accent surface, incoming align left on a neutral one, a run of
 * messages from one author shares a single avatar, and the tail only appears on
 * the message that closes the run.
 *
 * The metadata line sits inside the bubble at the bottom right and reserves its
 * own space rather than floating over the text, because a message whose last
 * line happens to end near the timestamp would otherwise collide with it.
 */
export function MessageBubble({
  container,
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
}: MessagePresentationProps) {
  const t = useT();

  const replyAuthor =
    message.replyTo?.author?.displayName ??
    message.replyTo?.author?.username ??
    t('common.unknown');

  return (
    <div
      {...container}
      className={cn(
        'group/message relative flex gap-2 px-3 md:px-4',
        isGroupStart ? 'mt-3 first:mt-0' : 'mt-0.5',
        message.failed && 'opacity-70',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {/* Incoming runs reserve the avatar column on every message so the
          bubbles in a run stay on one vertical line. */}
      {!mine ? (
        <div className="shrink-0 self-end" style={{ width: avatarSize }}>
          {isGroupEnd ? (
            <button
              type="button"
              onClick={() => onOpenProfile(message.authorId)}
              aria-label={t('chat.openProfile', { name: displayName })}
            >
              <Avatar user={message.author} size={avatarSize} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'relative min-w-0 max-w-[min(78%,620px)]',
          mine ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'relative px-3 py-1.5 text-message',
            'transition-colors duration-fast ease-out',
            mine ? 'bg-bubble-out text-text-heading' : 'bg-bubble-in text-text',
            mentionsMe && !mine && 'shadow-[inset_2px_0_0_var(--mention-text)]',
            // Square off the corner the tail hangs from, round everything else.
            'rounded-bubble',
            isGroupEnd && (mine ? 'rounded-br-bubble-tail' : 'rounded-bl-bubble-tail'),
          )}
        >
          {isGroupStart && !mine ? (
            <button
              type="button"
              onClick={() => onOpenProfile(message.authorId)}
              className="mb-0.5 block max-w-full truncate text-sm font-semibold hover:underline"
            >
              <DisplayName
                user={message.author}
                name={displayName}
                color={roleColor ?? 'var(--brand-hover)'}
              />
            </button>
          ) : null}

          {message.forwardedFrom ? (
            <div className="mb-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Forward size={13} className="shrink-0 text-text-faint" aria-hidden />
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
                'mb-1 flex w-full flex-col items-start gap-0.5 rounded-sm border-l-2 border-brand-hover',
                'bg-[rgba(255,255,255,0.05)] px-2 py-1 text-left',
              )}
            >
              <span className="max-w-full truncate text-xs font-semibold text-text-subheading">
                {replyAuthor}
              </span>
              <span className="max-w-full truncate text-xs text-text-muted">
                {message.replyTo.deleted ? t('chat.originalDeleted') : message.replyTo.content}
              </span>
            </button>
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
                <MessageContent content={message.content} />
              ) : null}

              <Attachments attachments={message.attachments} />
              <LinkPreviews previews={message.previews} />

              <BubbleMeta
                message={message}
                receipt={receipt}
                mine={mine}
                hasContent={Boolean(message.content)}
              />
            </>
          )}
        </div>

        {!editing ? (
          <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <Reactions
              reactions={message.reactions}
              onToggle={onToggleReaction}
              onAdd={onOpenEmojiPicker}
              disabled={!actions.canReact}
            />
          </div>
        ) : null}
      </div>

      {hasHover && hovered && !editing && !isMobile ? (
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
          className={cn('absolute -top-3', mine ? 'right-12' : 'left-12')}
        />
      ) : null}
    </div>
  );
}

/**
 * Time, edit marker and delivery ticks, inside the bubble.
 *
 * When the message has text this floats to the right of the last line and pads
 * it out of the way; without text (a lone attachment) it sits on its own line.
 */
function BubbleMeta({
  message,
  receipt,
  mine,
  hasContent,
}: {
  message: Pick<Message, 'createdAt' | 'editedAt' | 'pending' | 'failed'>;
  receipt?: MessageReceipt;
  mine: boolean;
  hasContent: boolean;
}) {
  const t = useT();

  return (
    <span
      className={cn(
        'select-none items-center gap-1 text-2xs leading-none text-text-muted',
        hasContent ? 'float-right ml-2 mt-1.5 inline-flex translate-y-px' : 'mt-1 flex',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {message.editedAt ? (
        <Tooltip content={messageTimestamp(message.editedAt)}>
          <span>{t('chat.edited')}</span>
        </Tooltip>
      ) : null}
      {message.failed ? <span className="text-danger">{t('chat.failed')}</span> : null}
      <Tooltip content={messageTimestamp(message.createdAt)}>
        <span className="tabular-nums">{shortTime(message.createdAt)}</span>
      </Tooltip>
      {message.pending ? (
        <Clock3Dot />
      ) : (
        <ReceiptMark receipt={receipt} />
      )}
    </span>
  );
}

/** Sending state: a clock rather than a tick, as Telegram does. */
function Clock3Dot() {
  return (
    <svg viewBox="0 0 14 14" width={13} height={13} aria-hidden className="text-text-faint">
      <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M7 4.2V7l1.9 1.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReceiptMark({ receipt }: { receipt?: MessageReceipt }) {
  if (!receipt) return null;
  const Icon = receipt === 'read' ? CheckCheck : Check;
  return (
    <Icon
      size={13}
      className={receipt === 'read' ? 'text-brand-hover' : 'text-text-faint'}
      aria-hidden
    />
  );
}
