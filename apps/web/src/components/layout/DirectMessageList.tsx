import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, X } from 'lucide-react';
import type { DirectConversation } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { conversationTitle, useConversations, useLeaveConversation } from '@/hooks/useDms';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { NewConversationDialog } from '@/components/modals/NewConversationDialog';
import { useAuthStore } from '@/stores/authStore';

export interface DirectMessageListProps {
  activeConversationId: string | undefined;
  /** Mobile renders 56px rows; the desktop sidebar uses 42px ones. */
  compact?: boolean;
  onSelect?: (conversation: DirectConversation) => void;
}

export function DirectMessageList({
  activeConversationId,
  compact = true,
  onSelect,
}: DirectMessageListProps) {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: conversations, isLoading } = useConversations();
  const leave = useLeaveConversation();
  const [newOpen, setNewOpen] = useState(false);

  if (isLoading) return <SidebarSkeleton />;

  return (
    <div className="flex flex-col px-2 pb-4 pt-2">
      <header className="flex items-center justify-between pl-2 pr-1">
        <span className="text-xs font-semibold uppercase tracking-[0.02em] text-text-muted">
          Direct Messages
        </span>
        <IconButton icon={Plus} label="New conversation" size="sm" onClick={() => setNewOpen(true)} />
      </header>

      <ul className="mt-1 flex flex-col gap-0.5">
        {conversations?.map((conversation) => {
          const active = conversation.id === activeConversationId;
          const others = conversation.members.filter((member) => member.id !== currentUserId);
          const title = conversationTitle(conversation, currentUserId);

          return (
            <li key={conversation.id} className="group/dm relative">
              <button
                type="button"
                onClick={() =>
                  onSelect
                    ? onSelect(conversation)
                    : navigate(`/channels/${DM_ROUTE}/${conversation.id}`)
                }
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded px-2 text-left',
                  compact ? 'min-h-11 md:min-h-[42px]' : 'min-h-14',
                  active
                    ? 'bg-surface-selected text-text-heading'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-subheading',
                )}
              >
                {conversation.isGroup ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-base-tertiary text-text-subheading">
                    <Users size={16} aria-hidden />
                  </span>
                ) : others[0] ? (
                  <Avatar user={others[0]} size={32} showStatus ringColor="var(--bg-secondary)" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-full bg-base-tertiary" />
                )}

                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn('truncate text-base', active && 'font-medium text-text-heading')}
                  >
                    {title}
                  </span>
                  {conversation.isGroup ? (
                    <span className="truncate text-xs text-text-muted">
                      {conversation.members.length} members
                    </span>
                  ) : null}
                </span>
              </button>

              {conversation.isGroup ? (
                <IconButton
                  icon={X}
                  label="Leave group"
                  size="sm"
                  className="absolute right-1 top-1/2 hidden -translate-y-1/2 md:inline-flex md:opacity-0 md:group-hover/dm:opacity-100"
                  onClick={() => leave.mutate(conversation.id)}
                />
              ) : null}
            </li>
          );
        })}

        {conversations?.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-text-muted">
            No conversations yet. Start one with the + above.
          </li>
        ) : null}
      </ul>

      <NewConversationDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
