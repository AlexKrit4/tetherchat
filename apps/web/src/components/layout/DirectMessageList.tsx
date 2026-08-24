import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Bookmark, LockKeyhole, Pin, Plus, Shield, Sparkles, Trash2, Users } from 'lucide-react';
import type { DirectConversation } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { conversationTitle, useConversations, useDeleteConversation } from '@/hooks/useDms';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { SidebarSkeleton } from '@/components/ui/Skeleton';
import { CreateChatDialog } from '@/components/modals/CreateChatDialog';
import { useT } from '@/i18n/useT';
import { useAuthStore } from '@/stores/authStore';
import { ContextMenu, useContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { usePinConversation } from '@/hooks/useFriends';
import { useBlockUser } from '@/components/settings/BlacklistSettings';
import { useLongPress } from '@/hooks/useLongPress';
import { useIsMobile } from '@/hooks/useMediaQuery';

export interface DirectMessageListProps {
  activeConversationId: string | undefined;
  compact?: boolean;
  onSelect?: (conversation: DirectConversation) => void;
}

export function DirectMessageList({
  activeConversationId,
  compact = true,
  onSelect,
}: DirectMessageListProps) {
  const t = useT();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: conversations, isLoading } = useConversations();
  const navigate = useNavigate();
  const remove = useDeleteConversation();
  const pin = usePinConversation();
  const block = useBlockUser();
  const [newOpen, setNewOpen] = useState(false);
  const menu = useContextMenu();

  const openMenu = (event: { clientX: number; clientY: number }, conversation: DirectConversation) => {
    const title = conversationTitle(conversation, currentUserId, t('dm.savedMessages'), t('dm.aiChat'), t('dm.vpnChat'));
    const peer = conversation.members.find((member) => member.id !== currentUserId);
    const locked = Boolean(conversation.isSaved || conversation.isAi || conversation.isVpn);

    const afterDelete = () => {
      if (conversation.id === activeConversationId) {
        navigate(`/channels/${DM_ROUTE}`);
      }
    };

    const items: MenuItem[] = [];
    if (!locked) {
      items.push({
        id: 'pin',
        label: conversation.pinned ? t('chat.unpinChat') : t('chat.pinChat'),
        icon: <Pin size={16} aria-hidden />,
        onSelect: () => pin.mutate({ conversationId: conversation.id, pinned: !conversation.pinned }),
      });
    }
    if (conversation.isGroup) {
      items.push({
        id: 'delete-me',
        label: t('chat.deleteForMe'),
        icon: <Trash2 size={16} aria-hidden />,
        tone: 'danger',
        onSelect: () => {
          if (!window.confirm(t('chat.deleteForMeConfirm', { name: title }))) return;
          remove.mutate({ conversationId: conversation.id, scope: 'me' }, { onSuccess: afterDelete });
        },
      });
      if (conversation.ownerId === currentUserId) {
        items.push({
          id: 'delete-all',
          label: t('chat.deleteForAll'),
          icon: <Trash2 size={16} aria-hidden />,
          tone: 'danger',
          onSelect: () => {
            if (!window.confirm(t('chat.deleteGroupForAllConfirm', { name: title }))) return;
            remove.mutate({ conversationId: conversation.id, scope: 'all' }, { onSuccess: afterDelete });
          },
        });
      }
    } else if (peer && !locked) {
      items.push({
        id: 'delete-me',
        label: t('chat.deleteForMe'),
        icon: <Trash2 size={16} aria-hidden />,
        tone: 'danger',
        onSelect: () => {
          if (!window.confirm(t('chat.deleteForMeConfirm', { name: title }))) return;
          remove.mutate({ conversationId: conversation.id, scope: 'me' }, { onSuccess: afterDelete });
        },
      });
      items.push({
        id: 'delete-all',
        label: t('chat.deleteForAll'),
        icon: <Trash2 size={16} aria-hidden />,
        tone: 'danger',
        onSelect: () => {
          if (!window.confirm(t('chat.deleteForAllConfirm', { name: title }))) return;
          remove.mutate({ conversationId: conversation.id, scope: 'all' }, { onSuccess: afterDelete });
        },
      });
      items.push({
        id: 'block',
        label: t('settings.blockUser'),
        icon: <Ban size={16} aria-hidden />,
        tone: 'danger',
        onSelect: () => {
          if (!window.confirm(t('settings.blockConfirm', { name: title }))) return;
          block.mutate(peer.id);
        },
      });
    }
    if (items.length > 0) menu.open(event, items);
  };

  if (isLoading) return <SidebarSkeleton />;

  return (
    <div className="flex flex-col px-2 pb-4 pt-2">
      <header className="flex items-center justify-between pl-2 pr-1">
        <span className="text-xs font-semibold uppercase tracking-[0.02em] text-text-muted">
          {t('dm.title')}
        </span>
        <IconButton icon={Plus} label="Новый чат" size="sm" onClick={() => setNewOpen(true)} />
      </header>

      <ul className="mt-1 flex flex-col gap-0.5">
        {conversations?.map((conversation) => (
          <DmRow
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeConversationId}
            compact={compact}
            currentUserId={currentUserId}
            onSelect={onSelect}
            onOpenMenu={openMenu}
          />
        ))}

        {conversations?.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-text-muted">{t('dm.emptyHint')}</li>
        ) : null}
      </ul>

      <CreateChatDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(conversation) => {
          if (onSelect) onSelect(conversation);
          else navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
        }}
      />
      <ContextMenu state={menu.state} onClose={menu.close} />
    </div>
  );
}

function DmRow({
  conversation,
  active,
  compact,
  currentUserId,
  onSelect,
  onOpenMenu,
}: {
  conversation: DirectConversation;
  active: boolean;
  compact: boolean;
  currentUserId: string | undefined;
  onSelect?: (conversation: DirectConversation) => void;
  onOpenMenu: (event: { clientX: number; clientY: number }, conversation: DirectConversation) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const others = conversation.members.filter((member) => member.id !== currentUserId);
  const title = conversationTitle(conversation, currentUserId, t('dm.savedMessages'), t('dm.aiChat'), t('dm.vpnChat'));
  const locked = Boolean(conversation.isSaved || conversation.isAi || conversation.isVpn);
  const longPress = useLongPress(
    () => onOpenMenu({ clientX: 24, clientY: 120 }, conversation),
    { enabled: isMobile && !locked },
  );

  return (
    <li className="group/dm relative">
      <button
        type="button"
        {...longPress}
        onContextMenu={(event) => {
          if (locked) return;
          event.preventDefault();
          onOpenMenu(event, conversation);
        }}
        onClick={() =>
          onSelect ? onSelect(conversation) : navigate(`/channels/${DM_ROUTE}/${conversation.id}`)
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
        {conversation.isSaved ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Bookmark size={16} aria-hidden />
          </span>
        ) : conversation.isAi ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#9b6bff] text-white">
            <Sparkles size={16} aria-hidden />
          </span>
        ) : conversation.isVpn ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white">
            <Shield size={16} aria-hidden />
          </span>
        ) : conversation.isGroup ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-text-subheading">
            <Users size={16} aria-hidden />
          </span>
        ) : others[0] ? (
          <Avatar user={others[0]} size={32} showStatus ringColor="var(--bg-secondary)" />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded-full bg-surface-tertiary" />
        )}

        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('truncate text-base', active && 'font-medium text-text-heading')}>
            {conversation.isSecret ? <LockKeyhole size={13} className="mr-1 inline text-success" /> : null}
            {title}
          </span>
          {conversation.isGroup ? (
            <span className="truncate text-xs text-text-muted">
              {t('server.membersCount', { count: conversation.members.length })}
            </span>
          ) : null}
        </span>
        {conversation.pinned && !conversation.isSaved && !conversation.isAi && !conversation.isVpn ? (
          <Pin size={12} className="shrink-0 text-text-faint" aria-hidden />
        ) : null}
      </button>
    </li>
  );
}
