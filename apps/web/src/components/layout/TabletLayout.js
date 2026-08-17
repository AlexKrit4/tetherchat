import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { AnimatePresence, motion } from 'framer-motion';
import { ServerRail } from './ServerRail';
import { ChannelSidebar } from './ChannelSidebar';
import { MemberList } from './MemberList';
import { ChatArea } from '@/components/chat/ChatArea';
import { useUiStore } from '@/stores/uiStore';
import { useChatTarget } from '@/hooks/useChatTarget';
/**
 * 768–1023px: rail, channels and chat stay side by side, but there is no room
 * for a fourth column, so members slide over the chat instead.
 */
export function TabletLayout() {
    const membersOpen = useUiStore((state) => state.membersOpen);
    const setMembersOpen = useUiStore((state) => state.setMembersOpen);
    const { channelId } = useChatTarget();
    return (_jsxs("div", { className: "relative flex h-screen-dvh w-full overflow-hidden bg-base-tertiary", children: [_jsx(ServerRail, {}), _jsx(ChannelSidebar, {}), _jsx(ChatArea, {}), _jsx(AnimatePresence, { children: membersOpen && channelId ? (_jsxs(_Fragment, { children: [_jsx(motion.button, { type: "button", "aria-label": "Close member list", className: "absolute inset-0 z-20 bg-base-overlay", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 }, onClick: () => setMembersOpen(false) }), _jsx(motion.div, { className: "absolute right-0 top-0 z-30 h-full w-[260px] shadow-floating", initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: { type: 'spring', damping: 30, stiffness: 320 }, children: _jsx(MemberList, { className: "h-full w-full" }) })] })) : null })] }));
}
//# sourceMappingURL=TabletLayout.js.map