import { ArrowLeft, AtSign, Bell, Bookmark, Hash, Image as ImageIcon, LockKeyhole, Phone, Pin, Search, Shield, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isGraphite } from '@/lib/theme';
import { useT } from '@/i18n/useT';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { ChatSettingsButton } from './ChatSettingsButton';
import { useCallStore } from '@/stores/callStore';
import { getSecretSafetyNumber } from '@/lib/e2ee';
import { conversationNeedsFriendship, isFriendOf, useFriends } from '@/hooks/useFriends';
import { lastSeenLabel } from '@/lib/plusDisplay';
import { DisplayName } from '@/components/plus/DisplayName';
import { usePresenceStore } from '@/stores/presenceStore';

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
  const setMediaOpen = useUiStore((state) => state.setMediaOpen);
  const popMobileView = useUiStore((state) => state.popMobileView);
  const pushMobileView = useUiStore((state) => state.pushMobileView);
  const startOutgoingCall = useCallStore((state) => state.startOutgoing);
  const callPhase = useCallStore((state) => state.phase);
  const { data: friends } = useFriends();
  const liveStatuses = usePresenceStore((state) => state.statuses);

  const titleClass = isGraphite() ? 'text-base tracking-heading' : 'text-lg';

  const dmPeer = conversation?.members.find((member) => member.id !== currentUserId);
  const canCall =
    isDm &&
    dmPeer &&
    !conversation?.isSaved &&
    !conversation?.isAi &&
    !conversation?.isVpn &&
    !conversation?.isGroup &&
    conversation?.id &&
    callPhase === 'idle' &&
    (!conversationNeedsFriendship(conversation, currentUserId) || isFriendOf(friends, dmPeer.id));
  const membersVisible = isDesktop ? membersColumnOpen : membersOverlayOpen;
  const showSafetyNumber = async () => {
    if (!currentUserId || !dmPeer) return;
    try {
      const code = await getSecretSafetyNumber(currentUserId, dmPeer.id);
      window.alert(
        `Код безопасности:\n\n${code}\n\nСравните этот код с собеседником по другому каналу. Совпадение подтверждает, что сервер не подменил ключи.`,
      );
    } catch {
      window.alert('Не удалось получить код безопасности');
    }
  };

  return (
    <header
      className={cn(
        'flex h-header shrink-0 items-center gap-1 bg-surface px-2 md:px-4',
        // Elevation carries a full ring in Graphite, which would outline the
        // header on all four sides; only the bottom edge is wanted.
        isGraphite() ? 'shadow-hairline-b' : 'shadow-elevated',
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
        {conversation?.isSecret ? (
          <button type="button" onClick={() => void showSafetyNumber()} title="Проверить код безопасности">
            <LockKeyhole size={18} className="shrink-0 text-success" aria-hidden />
          </button>
        ) : null}
        {isDm ? (
          conversation?.isSaved ? (
            <Bookmark size={20} className="shrink-0 text-brand" aria-hidden />
          ) : conversation?.isAi ? (
            <Sparkles size={20} className="shrink-0 text-[#9b6bff]" aria-hidden />
          ) : conversation?.isVpn ? (
            <Shield size={20} className="shrink-0 text-[#22c55e]" aria-hidden />
          ) : dmPeer ? (
            <Avatar user={dmPeer} size={24} showStatus />
          ) : (
            <AtSign size={20} className="shrink-0 text-text-faint" aria-hidden />
          )
        ) : (
          <Hash size={22} strokeWidth={2} className="shrink-0 text-text-faint" aria-hidden />
        )}

        {isDm && dmPeer && !conversation?.isGroup && !conversation?.isSaved && !conversation?.isAi && !conversation?.isVpn ? (
          <div className="min-w-0 flex-1">
            <h1 className={cn('min-w-0 truncate font-semibold text-text-heading', titleClass)}>
              <DisplayName user={dmPeer} name={title || '…'} />
            </h1>
            <p className="truncate text-xs text-text-muted">
              {lastSeenLabel(dmPeer, liveStatuses[dmPeer.id])}
              {conversation?.peerHasPlusProtect ? ` · ${t('plus.peerProtect')}` : ''}
            </p>
          </div>
        ) : (
          <h1 className={cn('truncate font-semibold text-text-heading', titleClass)}>
            {title || '…'}
          </h1>
        )}
        {conversation?.isSecret ? (
          <span className="hidden text-xs font-medium text-success sm:inline">E2EE · ключи только на устройствах</span>
        ) : null}

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
        ) : canCall ? (
          <IconButton
            icon={Phone}
            label={t('call.start')}
            size={isMobile ? 'lg' : 'md'}
            onClick={() => void startOutgoingCall(conversation!.id)}
          />
        ) : null}

        {!conversation?.isSecret ? (
          <IconButton
            icon={ImageIcon}
            label={t('chat.mediaTitle')}
            size={isMobile ? 'lg' : 'md'}
            onClick={() => setMediaOpen(true)}
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

        {!conversation?.isSecret ? (
          <IconButton
            icon={Search}
            label={t('chat.search')}
            size={isMobile ? 'lg' : 'md'}
            onClick={() => (isMobile ? pushMobileView('search') : setSearchOpen(true))}
          />
        ) : null}

        <ChatSettingsButton />
      </div>
    </header>
  );
}
