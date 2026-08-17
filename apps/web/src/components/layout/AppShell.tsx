import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLayout } from '@/hooks/useMediaQuery';
import { firstChannelId, useChatTarget } from '@/hooks/useChatTarget';
import { useRealtime } from '@/hooks/useRealtime';
import { useKeyboardOffsetVariable } from '@/hooks/useMobileKeyboard';
import { DesktopLayout } from './DesktopLayout';
import { TabletLayout } from './TabletLayout';
import { MobileLayout } from './MobileLayout';
import { ConnectionBanner } from './ConnectionBanner';

/**
 * Chooses the layout for the current viewport and owns the app-wide side
 * effects: socket lifecycle, keyboard offset variable and channel redirects.
 */
export function AppShell() {
  const layout = useLayout();
  const connection = useRealtime();
  const navigate = useNavigate();
  const { serverId, channelId, server, isDm } = useChatTarget();

  useKeyboardOffsetVariable();

  // Opening a server without a channel lands on its first channel.
  useEffect(() => {
    if (isDm || channelId || !server) return;
    const target = firstChannelId(server);
    if (target) navigate(`/channels/${server.id}/${target}`, { replace: true });
  }, [channelId, isDm, navigate, server, serverId]);

  return (
    <>
      <ConnectionBanner state={connection} />
      {layout === 'mobile' ? <MobileLayout /> : null}
      {layout === 'tablet' ? <TabletLayout /> : null}
      {layout === 'desktop' ? <DesktopLayout /> : null}
    </>
  );
}
