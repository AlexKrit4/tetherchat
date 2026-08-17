import { ArrowLeft, AtSign, Bell, Hash, Pin, Search, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * 48px bar above the message list. On mobile the leading slot becomes a back
 * button, and every action is a 44px touch target.
 */
export function ChatHeader() {
  const isMobile = useIsMobile();
  const { title, topic, isDm, conversation } = useChatTarget();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const membersOpen = useUiStore((state) => state.membersOpen);
  const toggleMembers = useUiStore((state) => state.toggleMembers);
  const setPinsOpen = useUiStore((state) => state.setPinsOpen);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);
  const popMobileView = useUiStore((state) => state.popMobileView);
  const pushMobileView = useUiStore((state) => state.pushMobileView);

  const dmPeer = conversation?.members.find((member) => member.id !== currentUserId);

  return (
    <header
      className={cn(
        'flex h-header shrink-0 items-center gap-1 bg-base px-2 shadow-elevated md:px-4',
      )}
    >
      {isMobile ? (
        <IconButton
          icon={ArrowLeft}
          label="Back"
          size="lg"
          showTooltip={false}
          onClick={popMobileView}
          className="-ml-1"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isDm ? (
          dmPeer ? (
            <Avatar user={dmPeer} size={24} showStatus />
          ) : (
            <AtSign size={20} className="shrink-0 text-text-faint" aria-hidden />
          )
        ) : (
          <Hash size={22} strokeWidth={2} className="shrink-0 text-text-faint" aria-hidden />
        )}

        <h1 className="truncate text-lg font-semibold text-text-heading">{title || '…'}</h1>

        {topic ? (
          <>
            <span className="hidden h-6 w-px shrink-0 bg-divider lg:block" aria-hidden />
            <p className="hidden min-w-0 truncate text-sm text-text-muted lg:block">{topic}</p>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {!isDm ? (
          <IconButton
            icon={Bell}
            label="Notification settings"
            size={isMobile ? 'lg' : 'md'}
            className="hidden md:inline-flex"
          />
        ) : null}

        <IconButton
          icon={Pin}
          label="Pinned messages"
          size={isMobile ? 'lg' : 'md'}
          onClick={() => setPinsOpen(true)}
        />

        <IconButton
          icon={Users}
          label={membersOpen ? 'Hide member list' : 'Show member list'}
          size={isMobile ? 'lg' : 'md'}
          active={membersOpen}
          onClick={() => (isMobile ? pushMobileView('members') : toggleMembers())}
        />

        <IconButton
          icon={Search}
          label="Search"
          size={isMobile ? 'lg' : 'md'}
          onClick={() => (isMobile ? pushMobileView('search') : setSearchOpen(true))}
        />
      </div>
    </header>
  );
}
