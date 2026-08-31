import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIMITS } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { useCreateServer } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { firstChannelId } from '@/hooks/useChatTarget';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

export function CreateServerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const create = useCreateServer();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < LIMITS.serverName.min) {
      setError(t('server.nameMin', { min: LIMITS.serverName.min }));
      return;
    }

    create.mutate(trimmed, {
      onSuccess: (server) => {
        const channelId = firstChannelId(server);
        navigate(`/channels/${server.id}${channelId ? `/${channelId}` : ''}`);
        if (isMobile) pushMobileView('chat');
        setName('');
        onClose();
        toast.success(t('server.createReady', { name: server.name }));
      },
      onError: (mutationError) => setError(errorMessage(mutationError)),
    });
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title={t('server.createTitle')}
      description={t('server.createDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <Input
        label={t('server.name')}
        autoFocus
        value={name}
        error={error}
        maxLength={LIMITS.serverName.max}
        placeholder={t('server.namePlaceholder')}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
        hint={t('server.createHint')}
      />
    </AdaptiveDialog>
  );
}
