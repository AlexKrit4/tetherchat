import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { useJoinServer } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/stores/uiStore';

/** Accepts a bare code or a full tetherchat.ru/invite/<code> link. */
function extractCode(value: string): string {
  const trimmed = value.trim();
  const match = /invite\/([a-zA-Z0-9-]+)/.exec(trimmed);
  return (match ? match[1] : trimmed).replace(/[^a-zA-Z0-9-]/g, '');
}

export function JoinServerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const join = useJoinServer();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const code = extractCode(value);
    if (code.length < 4) {
      setError(t('server.joinInvalid'));
      return;
    }

    join.mutate(code, {
      onSuccess: ({ serverId }) => {
        navigate(`/channels/${serverId}`);
        if (isMobile) pushMobileView('channels');
        setValue('');
        onClose();
        toast.success(t('server.joined'));
      },
      onError: (mutationError) => setError(errorMessage(mutationError)),
    });
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title={t('server.joinTitle')}
      description={t('server.joinDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={join.isPending} onClick={submit}>
            {t('common.join')}
          </Button>
        </>
      }
    >
      <Input
        label={t('server.inviteLink')}
        autoFocus
        value={value}
        error={error}
        placeholder="https://tetherchat.ru/invite/friendos"
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
      />
    </AdaptiveDialog>
  );
}
