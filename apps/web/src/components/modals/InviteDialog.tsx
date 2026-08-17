import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import type { ServerDetail } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { useCreateInvite } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toastStore';

export interface InviteDialogProps {
  server: ServerDetail;
  open: boolean;
  onClose: () => void;
}

/** Invites resolve to tetherchat.ru/invite/<code> in production. */
export function InviteDialog({ server, open, onClose }: InviteDialogProps) {
  const t = useT();
  const createInvite = useCreateInvite(server.id);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || code) return;
    createInvite.mutate(
      {},
      {
        onSuccess: (invite) => setCode(invite.code),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
    // Creating the invite once per open is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const link = code ? `${window.location.origin}/invite/${code}` : '';

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      toast.error(t('inviteDialog.copyFailed'));
    }
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={() => {
        setCode(null);
        onClose();
      }}
      title={t('inviteDialog.title', { name: server.name })}
      description={t('inviteDialog.description')}
      width="md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-surface-tertiary p-2">
          <input
            readOnly
            value={link}
            aria-label={t('inviteDialog.link')}
            className="min-w-0 flex-1 bg-transparent px-1 text-base text-text outline-none"
          />
          <Button size="sm" onClick={() => void copy()} disabled={!link}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? t('common.copied') : t('common.copy')}
          </Button>
        </div>

        <button
          type="button"
          onClick={() =>
            createInvite.mutate(
              {},
              {
                onSuccess: (invite) => {
                  setCode(invite.code);
                  toast.success(t('inviteDialog.generated'));
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
          className="flex items-center gap-1.5 self-start text-sm text-text-link hover:underline"
        >
          <RefreshCw size={14} aria-hidden />
          {t('inviteDialog.newLink')}
        </button>
      </div>
    </AdaptiveDialog>
  );
}
