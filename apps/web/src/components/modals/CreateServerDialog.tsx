import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIMITS } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useCreateServer } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { firstChannelId } from '@/hooks/useChatTarget';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

export function CreateServerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const create = useCreateServer();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < LIMITS.serverName.min) {
      setError(`Use at least ${LIMITS.serverName.min} characters`);
      return;
    }

    create.mutate(trimmed, {
      onSuccess: (server) => {
        const channelId = firstChannelId(server);
        navigate(`/channels/${server.id}${channelId ? `/${channelId}` : ''}`);
        if (isMobile) pushMobileView('chat');
        setName('');
        onClose();
        toast.success(`${server.name} is ready`);
      },
      onError: (mutationError) => setError(errorMessage(mutationError)),
    });
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title="Create a server"
      description="Your server is where you and your friends hang out. Make yours and start talking."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <Input
        label="Server name"
        autoFocus
        value={name}
        error={error}
        maxLength={LIMITS.serverName.max}
        placeholder="Friendos"
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
        hint="A #general and #off-topic channel are created for you."
      />
    </AdaptiveDialog>
  );
}
