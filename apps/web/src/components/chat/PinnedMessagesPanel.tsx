import { Pin } from 'lucide-react';
import { useChatTarget } from '@/hooks/useChatTarget';
import { usePins } from '@/hooks/useMessages';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { messageTimestamp } from '@/lib/time';
import { MessageContent } from './MessageContent';
import { useUiStore } from '@/stores/uiStore';

export function PinnedMessagesPanel() {
  const open = useUiStore((state) => state.pinsOpen);
  const setOpen = useUiStore((state) => state.setPinsOpen);
  const { channelId, isDm } = useChatTarget();
  const { data: pins, isLoading } = usePins(channelId, open && !isDm);

  return (
    <AdaptiveDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Pinned Messages"
      width="md"
    >
      {isDm ? (
        <p className="py-6 text-center text-base text-text-muted">
          Pins are available in server channels.
        </p>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : pins && pins.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {pins.map((message) => (
            <li key={message.id} className="rounded-lg bg-surface-secondary p-3">
              <div className="flex items-center gap-2">
                <Avatar user={message.author} size={24} />
                <span className="text-base font-medium text-text-heading">
                  {message.author.displayName ?? message.author.username}
                </span>
                <span className="text-xs text-text-muted">{messageTimestamp(message.createdAt)}</span>
              </div>
              <div className="mt-1">
                <MessageContent content={message.content} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Pin size={32} className="text-text-faint" aria-hidden />
          <p className="text-base text-text-muted">
            Nothing pinned yet. Pin a message to keep it handy.
          </p>
        </div>
      )}
    </AdaptiveDialog>
  );
}
