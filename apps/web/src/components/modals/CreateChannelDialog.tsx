import { useState } from 'react';
import { Hash } from 'lucide-react';
import { LIMITS } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useCreateChannel } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';

export interface CreateChannelDialogProps {
  serverId: string;
  categoryId: string | null;
  open: boolean;
  onClose: () => void;
}

export function CreateChannelDialog({
  serverId,
  categoryId,
  open,
  onClose,
}: CreateChannelDialogProps) {
  const create = useCreateChannel(serverId);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Give the channel a name');
      return;
    }

    create.mutate(
      { name: trimmed, categoryId, topic: topic.trim() || null },
      {
        onSuccess: (channel) => {
          setName('');
          setTopic('');
          onClose();
          toast.success(`#${channel.name} created`);
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
      },
    );
  };

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title="Create a text channel"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Create channel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label={
            <span className="inline-flex items-center gap-1">
              <Hash size={12} strokeWidth={3} aria-hidden />
              Channel name
            </span>
          }
          autoFocus
          value={name}
          error={error}
          maxLength={LIMITS.channelName.max}
          placeholder="new-channel"
          onChange={(event) => {
            setName(event.target.value.replace(/\s+/g, '-').toLowerCase());
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />

        <Input
          label="Topic"
          value={topic}
          maxLength={LIMITS.channelTopic.max}
          placeholder="What is this channel about?"
          onChange={(event) => setTopic(event.target.value)}
        />
      </div>
    </AdaptiveDialog>
  );
}
