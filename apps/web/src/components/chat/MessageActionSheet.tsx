import { Copy, Flag, Forward, Pencil, Pin, Reply, SmilePlus, Trash2 } from 'lucide-react';
import type { Message } from '@tetherchat/shared';
import { useT } from '@/i18n/useT';
import { BottomSheet, SheetAction } from '@/components/ui/BottomSheet';
import { toast } from '@/stores/toastStore';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🔥'];

export interface MessageActionSheetProps {
  message: Message | null;
  onClose: () => void;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  onReply: (message: Message) => void;
  onForward?: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onOpenEmojiPicker: (message: Message) => void;
  onReport?: (message: Message) => void;
}

/**
 * Mobile message menu. Opens on long-press and leads with a quick reaction row,
 * which is the fastest interaction on a phone.
 */
export function MessageActionSheet({
  message,
  onClose,
  canEdit,
  canDelete,
  canPin,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onTogglePin,
  onReact,
  onOpenEmojiPicker,
  onReport,
}: MessageActionSheetProps) {
  const t = useT();

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <BottomSheet open={Boolean(message)} onClose={onClose}>
      {message ? (
        <div className="pb-2">
          <div className="flex items-center justify-between gap-1 px-3 pb-3 pt-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={t('chat.reactWith', { emoji })}
                onClick={() => run(() => onReact(message, emoji))}
                className="flex h-touch w-touch items-center justify-center rounded-full bg-surface-secondary text-xl active:bg-surface-hover"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              aria-label={t('chat.moreReactions')}
              onClick={() => run(() => onOpenEmojiPicker(message))}
              className="flex h-touch w-touch items-center justify-center rounded-full bg-surface-secondary text-text-muted active:bg-surface-hover"
            >
              <SmilePlus size={20} aria-hidden />
            </button>
          </div>

          <div className="h-px bg-divider" />

          <div className="pt-1">
            <SheetAction
              icon={<Reply size={18} aria-hidden />}
              label={t('chat.reply')}
              onSelect={() => run(() => onReply(message))}
            />
            {onForward ? (
              <SheetAction
                icon={<Forward size={18} aria-hidden />}
                label={t('chat.forward')}
                onSelect={() => run(() => onForward(message))}
              />
            ) : null}
            <SheetAction
              icon={<Copy size={18} aria-hidden />}
              label={t('chat.copyText')}
              onSelect={() =>
                run(() => {
                  void navigator.clipboard.writeText(message.content);
                  toast.success(t('chat.copied'));
                })
              }
            />
            {canEdit ? (
              <SheetAction
                icon={<Pencil size={18} aria-hidden />}
                label={t('chat.editMessage')}
                onSelect={() => run(() => onEdit(message))}
              />
            ) : null}
            {canPin ? (
              <SheetAction
                icon={<Pin size={18} aria-hidden />}
                label={message.pinned ? t('chat.unpinMessage') : t('chat.pinMessage')}
                onSelect={() => run(() => onTogglePin(message))}
              />
            ) : null}
            {canDelete ? (
              <SheetAction
                icon={<Trash2 size={18} aria-hidden />}
                label={t('chat.deleteMessage')}
                tone="danger"
                onSelect={() => run(() => onDelete(message))}
              />
            ) : null}
            {onReport && message.authorId ? (
              <SheetAction
                icon={<Flag size={18} aria-hidden />}
                label={t('report.title')}
                tone="danger"
                onSelect={() => run(() => onReport(message))}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
