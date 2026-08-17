import { ArrowLeft, AtSign, Bell, Hash, Pin, Search, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * 48px bar above the message list. On mobile the leading slot becomes a back
 * button, and every action is a 44px touch target.
 */
export function ChatHeader() {
  const t = useT();
  const isMobile = useIsMobile();
  const { title, topic, isDm, conversation } = useChatTarget();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const isDesktop = useIsDesktop();
  const membersColumnOpen = useUiStore((state) => state.membersOpen);
  const membersOverlayOpen = useUiStore((state) => state.membersOverlayOpen);
  const toggleMembers = useUiStore((state) => state.toggleMembers);
  const toggleMembersOverlay = useUiStore((state) => state.toggleMembersOverlay);
  const setPinsOpen = useUiStore((state) => state.setPinsOpen);
  const setSearchOpen = useUiStore((state) => state.setSearchOpen);
  const popMobileView = useUiStore((state) => state.popMobileView);
  const pushMobileView = useUiStore((state) => state.pushMobileView);

  const dmPeer = conversation?.members.find((member) => member.id !== currentUserId);
  const membersVisible = isDesktop ? membersColumnOpen : membersOverlayOpen;

  return (
    <header
      className={cn(
        'flex h-header shrink-0 items-center gap-1 bg-surface px-2 shadow-elevated md:px-4',
      )}
    >
      {isMobile ? (
        <IconButton
          icon={ArrowLeft}
          label={t('common.back')}
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
            label={t('chat.notificationSettings')}
            size={isMobile ? 'lg' : 'md'}
            className="hidden md:inline-flex"
          />
        ) : null}

        <IconButton
          icon={Pin}
          label={t('chat.pinned')}
          size={isMobile ? 'lg' : 'md'}
          onClick={() => setPinsOpen(true)}
        />

        <IconButton
          icon={Users}
          label={membersVisible ? t('chat.hideMembers') : t('chat.showMembers')}
          size={isMobile ? 'lg' : 'md'}
          active={membersVisible}
          onClick={() => {
            if (isMobile) pushMobileView('members');
            else if (isDesktop) toggleMembers();
            else toggleMembersOverlay();
          }}
        />

        <IconButton
          icon={Search}
          label={t('chat.search')}
          size={isMobile ? 'lg' : 'md'}
          onClick={() => (isMobile ? pushMobileView('search') : setSearchOpen(true))}
        />
      </div>
    </header>
  );
}
