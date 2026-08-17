import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { useUiStore } from '@/stores/uiStore';
import { MobileServersView } from '@/components/mobile/MobileServersView';
import { MobileChannelsView } from '@/components/mobile/MobileChannelsView';
import { MobileChatView } from '@/components/mobile/MobileChatView';
import { MobileDirectMessagesView } from '@/components/mobile/MobileDirectMessagesView';
import { MobileMembersView } from '@/components/mobile/MobileMembersView';
import { MobileSearchView } from '@/components/mobile/MobileSearchView';
import { MobileSettingsView } from '@/components/mobile/MobileSettingsView';
import type { MobileView } from '@/stores/uiStore';

/**
 * Phones show exactly one panel at a time and navigate between them with a
 * history stack, the same way the Discord app does. Nothing here is a scaled-down
 * desktop column: each view is full width with its own header.
 */
export function MobileLayout() {
  const mobileView = useUiStore((state) => state.mobileView);
  const setMobileView = useUiStore((state) => state.setMobileView);
  const popMobileView = useUiStore((state) => state.popMobileView);
  const { channelId, serverId, isDm } = useChatTarget();

  // Landing on a URL without a channel shows the matching picker, not empty chat.
  // "@me" is a route marker rather than a server, so it resolves to the DM list.
  useEffect(() => {
    if (channelId) return;
    const needsChannel: MobileView[] = ['chat', 'members', 'search'];
    if (!needsChannel.includes(mobileView) && !(isDm && mobileView === 'channels')) return;

    const fallback: MobileView = isDm ? 'dms' : serverId ? 'channels' : 'servers';
    if (fallback !== mobileView) setMobileView(fallback);
  }, [channelId, isDm, mobileView, serverId, setMobileView]);

  useSwipeBack(popMobileView, mobileView !== 'servers');

  // The hardware/browser back button unwinds the panel stack before leaving the app.
  useEffect(() => {
    const onPopState = () => {
      if (useUiStore.getState().mobileView !== 'chat') {
        popMobileView();
        window.history.pushState({ tetherchat: true }, '');
      }
    };
    window.history.pushState({ tetherchat: true }, '');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [popMobileView]);

  return (
    <div className="relative flex h-screen-dvh w-full flex-col overflow-hidden bg-surface-tertiary px-safe pt-safe">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={mobileView}
          className="absolute inset-0 flex flex-col"
          initial={{ x: enterFrom(mobileView), opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: exitTo(mobileView), opacity: 0.6 }}
          transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
        >
          {renderView(mobileView)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function renderView(view: MobileView) {
  switch (view) {
    case 'servers':
      return <MobileServersView />;
    case 'channels':
      return <MobileChannelsView />;
    case 'dms':
      return <MobileDirectMessagesView />;
    case 'members':
      return <MobileMembersView />;
    case 'search':
      return <MobileSearchView />;
    case 'settings':
      return <MobileSettingsView />;
    case 'chat':
    default:
      return <MobileChatView />;
  }
}

/** Deeper views slide in from the right; the server list sits leftmost. */
function enterFrom(view: MobileView): string {
  return view === 'servers' ? '-30%' : '30%';
}

function exitTo(view: MobileView): string {
  return view === 'servers' ? '-30%' : '30%';
}
