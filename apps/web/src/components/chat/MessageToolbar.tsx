import { Flag, Forward, MessagesSquare, Pencil, Pin, Reply, SmilePlus, Trash2 } from 'lucide-react';
import type { Message } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/components/ui/IconButton';
import type { MessageActionSet } from './messagePresentation';

export interface MessageToolbarProps {
  message: Message;
  actions: MessageActionSet;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onOpenEmojiPicker: () => void;
  onForward?: (message: Message) => void;
  onReport?: (message: Message) => void;
  onOpenThread?: (message: Message) => void;
  className?: string;
}

/**
 * Hover actions for a message. Desktop only — touch devices reach the same set
 * through a long-press sheet. Both message layouts share the buttons and differ
 * only in where the strip is anchored, which each passes in via className.
 */
export function MessageToolbar({
  message,
  actions,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onOpenEmojiPicker,
  onForward,
  onReport,
  onOpenThread,
  className,
}: MessageToolbarProps) {
  const t = useT();

  return (
    <div
      className={cn(
        'z-10 flex items-center gap-0.5 rounded bg-surface-secondary p-0.5',
        isGraphite() ? 'shadow-hairline-strong' : 'shadow-elevated',
        className,
      )}
    >
      {actions.canReact ? (
        <IconButton
          icon={SmilePlus}
          label={t('chat.addReaction')}
          size="sm"
          onClick={onOpenEmojiPicker}
        />
      ) : null}
      <IconButton icon={Reply} label={t('chat.reply')} size="sm" onClick={() => onReply(message)} />
      {onOpenThread ? (
        <IconButton
          icon={MessagesSquare}
          label={t('chat.openThread')}
          size="sm"
          onClick={() => onOpenThread(message)}
        />
      ) : null}
      {onForward ? (
        <IconButton
          icon={Forward}
          label={t('chat.forward')}
          size="sm"
          onClick={() => onForward(message)}
        />
      ) : null}
      {actions.canEdit ? (
        <IconButton icon={Pencil} label={t('chat.edit')} size="sm" onClick={() => onEdit(message)} />
      ) : null}
      {actions.canPin ? (
        <IconButton
          icon={Pin}
          label={message.pinned ? t('chat.unpin') : t('chat.pin')}
          size="sm"
          active={message.pinned}
          onClick={() => onTogglePin(message)}
        />
      ) : null}
      {actions.canDelete ? (
        <IconButton
          icon={Trash2}
          label={t('chat.delete')}
          size="sm"
          tone="danger"
          onClick={() => onDelete(message)}
        />
      ) : null}
      {onReport && message.authorId ? (
        <IconButton
          icon={Flag}
          label={t('report.title')}
          size="sm"
          tone="danger"
          onClick={() => onReport(message)}
        />
      ) : null}
    </div>
  );
}
