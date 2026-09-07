import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '@/hooks/useMediaQuery';
import { firstChannelId, useChatTarget } from '@/hooks/useChatTarget';
import { useRealtime } from '@/hooks/useRealtime';
import { usePresenceLifecycle } from '@/hooks/usePresenceLifecycle';
import { useKeyboardOffsetVariable } from '@/hooks/useMobileKeyboard';
import { DesktopLayout } from './DesktopLayout';
import { TabletLayout } from './TabletLayout';
import { MobileLayout } from './MobileLayout';
import { ConnectionBanner } from './ConnectionBanner';
import { NotificationBanner } from './NotificationBanner';
import { CommandPalette } from '@/components/system/CommandPalette';
import { isGraphite } from '@/lib/theme';
import { CallOverlay } from '@/components/call/CallOverlay';
import { CallBanner } from '@/components/call/CallBanner';
import { PlusUpsellSheet } from '@/components/plus/PlusUpsellSheet';
import { SecretProtectOverlay } from '@/components/plus/SecretProtectOverlay';
import { useDraftSync } from '@/hooks/useDraftSync';
import { useAppBadge } from '@/hooks/useAppBadge';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { useAuthStore } from '@/stores/authStore';
import { ensureE2eeDevice, processPendingSecretClaims } from '@/lib/e2ee';

/**
 * Chooses the layout for the current viewport and owns the app-wide side
 * effects: socket lifecycle, keyboard offset variable and channel redirects.
 */
export function AppShell() {
  const layout = useLayout();
  const connection = useRealtime();
  useLiveKitRoom();
  useDraftSync();
  useAppBadge();
  const userId = useAuthStore((state) => state.user?.id);
  usePresenceLifecycle();
  const navigate = useNavigate();
  const { serverId, channelId, server, isDm } = useChatTarget();

  useKeyboardOffsetVariable();

  useEffect(() => {
    if (!userId || !window.crypto?.subtle || !window.indexedDB) return;
    void ensureE2eeDevice(userId)
      .then(() => processPendingSecretClaims(userId))
      .catch(() => undefined);
  }, [userId]);

  // Opening a server without a channel lands on its first channel.
  useEffect(() => {
    if (isDm || channelId || !server) return;
    const target = firstChannelId(server);
    if (target) navigate(`/channels/${server.id}/${target}`, { replace: true });
  }, [channelId, isDm, navigate, server, serverId]);

  return (
    <div className="h-full">
      <ConnectionBanner state={connection} />
      <NotificationBanner />
      <CallOverlay />
      <CallBanner />
      <PlusUpsellSheet />
      <SecretProtectOverlay />
      {isGraphite() ? <CommandPalette /> : null}
      {layout === 'mobile' ? <MobileLayout /> : null}
      {layout === 'tablet' ? <TabletLayout /> : null}
      {layout === 'desktop' ? <DesktopLayout /> : null}
    </div>
  );
}
