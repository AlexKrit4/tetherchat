import { useState } from 'react';
import { LIMITS } from '@tetherchat/shared';
import type { Channel, ServerDetail } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useT } from '@/i18n/useT';
import { useDeleteChannel, useUpdateChannel } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';

export interface ChannelSettingsDialogProps {
  server: ServerDetail;
  channel: Channel;
  open: boolean;
  onClose: () => void;
}

export function ChannelSettingsDialog({
  server,
  channel,
  open,
  onClose,
}: ChannelSettingsDialogProps) {
  const t = useT();
  const update = useUpdateChannel(server.id);
  const remove = useDeleteChannel(server.id);
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <AdaptiveDialog
      open={open}
      onClose={onClose}
      title={`#${channel.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { channelId: channel.id, name: name.trim(), topic: topic.trim() || null },
                {
                  onSuccess: () => {
                    onClose();
                    toast.success(t('channel.channelUpdated'));
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            {t('settings.saveChanges')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label={t('channel.settingsName')}
          value={name}
          maxLength={LIMITS.channelName.max}
          onChange={(event) => setName(event.target.value.replace(/\s+/g, '-').toLowerCase())}
        />

        <Textarea
          label={t('channel.settingsTopic')}
          rows={3}
          value={topic}
          maxLength={LIMITS.channelTopic.max}
          placeholder={t('channel.settingsTopicHint')}
          onChange={(event) => setTopic(event.target.value)}
        />

        <div className="h-px bg-divider" />

        {confirmDelete ? (
          <div className="flex flex-col gap-2 rounded-lg bg-[rgba(242,63,67,0.08)] p-3">
            <p className="text-base text-text">
              {t('channel.deleteConfirm', { name: channel.name })}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                {t('channel.keepChannel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={remove.isPending}
                onClick={() =>
                  remove.mutate(channel.id, {
                    onSuccess: () => {
                      onClose();
                      toast.success(t('channel.channelDeleted'));
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              >
                {t('channel.deleteChannel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            {t('channel.deleteChannel')}
          </Button>
        )}
      </div>
    </AdaptiveDialog>
  );
}
