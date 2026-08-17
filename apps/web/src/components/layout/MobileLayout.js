import { jsx as _jsx } from "react/jsx-runtime";
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
/**
 * Phones show exactly one panel at a time and navigate between them with a
 * history stack, the same way the Discord app does. Nothing here is a scaled-down
 * desktop column: each view is full width with its own header.
 */
export function MobileLayout() {
    const mobileView = useUiStore((state) => state.mobileView);
    const setMobileView = useUiStore((state) => state.setMobileView);
    const popMobileView = useUiStore((state) => state.popMobileView);
    const { channelId, serverId } = useChatTarget();
    // Landing on a URL without a channel should show the picker, not empty chat.
    useEffect(() => {
        if (!channelId && (mobileView === 'chat' || mobileView === 'members')) {
            setMobileView(serverId ? 'channels' : 'servers');
        }
    }, [channelId, mobileView, serverId, setMobileView]);
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
    return (_jsx("div", { className: "relative flex h-screen-dvh w-full flex-col overflow-hidden bg-base-tertiary px-safe pt-safe", children: _jsx(AnimatePresence, { initial: false, mode: "popLayout", children: _jsx(motion.div, { className: "absolute inset-0 flex flex-col", initial: { x: enterFrom(mobileView), opacity: 0.6 }, animate: { x: 0, opacity: 1 }, exit: { x: exitTo(mobileView), opacity: 0.6 }, transition: { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.22 }, children: renderView(mobileView) }, mobileView) }) }));
}
function renderView(view) {
    switch (view) {
        case 'servers':
            return _jsx(MobileServersView, {});
        case 'channels':
            return _jsx(MobileChannelsView, {});
        case 'dms':
            return _jsx(MobileDirectMessagesView, {});
        case 'members':
            return _jsx(MobileMembersView, {});
        case 'search':
            return _jsx(MobileSearchView, {});
        case 'settings':
            return _jsx(MobileSettingsView, {});
        case 'chat':
        default:
            return _jsx(MobileChatView, {});
    }
}
/** Deeper views slide in from the right; the server list sits leftmost. */
function enterFrom(view) {
    return view === 'servers' ? '-30%' : '30%';
}
function exitTo(view) {
    return view === 'servers' ? '-30%' : '30%';
}
//# sourceMappingURL=MobileLayout.js.map