import { useState } from 'react';
import type { Message } from '@tetherchat/shared';
import { isImageMime } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toastStore';
import { MessageContent } from './MessageContent';

export function ReportDialog({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  const t = useT();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message || comment.trim().length === 0) return;
    setBusy(true);
    try {
      await api.post('/api/reports', { messageId: message.id, comment: comment.trim() });
      toast.success(t('report.sent'));
      setComment('');
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdaptiveDialog
      open={Boolean(message)}
      onClose={() => {
        setComment('');
        onClose();
      }}
      title={t('report.title')}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setComment('');
              onClose();
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button loading={busy} disabled={comment.trim().length === 0} onClick={() => void submit()}>
            {t('report.submit')}
          </Button>
        </>
      }
    >
      {message ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-surface-secondary p-3">
            <p className="text-xs font-semibold text-text-muted">
              @{message.author.displayName ?? message.author.username}
            </p>
            {message.content ? (
              <div className="mt-1">
                <MessageContent content={message.content} />
              </div>
            ) : null}
            {message.attachments.filter((item) => isImageMime(item.contentType)).map((attachment) => (
              <img
                key={attachment.id}
                src={attachment.url}
                alt={attachment.filename}
                className="mt-2 max-h-48 w-full rounded object-contain"
              />
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.02em] text-text-muted">
              {t('report.comment')}
            </span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={4}
              className="resize-none rounded-lg bg-surface-input px-3 py-2 text-base text-text outline-none ring-brand focus:ring-2"
              placeholder={t('report.commentPlaceholder')}
            />
          </label>
        </div>
      ) : null}
    </AdaptiveDialog>
  );
}
