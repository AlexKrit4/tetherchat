import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ServerRail } from './ServerRail';
import { ChannelSidebar } from './ChannelSidebar';
import { MemberList } from './MemberList';
import { ChatArea } from '@/components/chat/ChatArea';
import { useUiStore } from '@/stores/uiStore';
import { useChatTarget } from '@/hooks/useChatTarget';
/**
 * The classic four-column arrangement at ≥1024px:
 * 72px rail · 240px channels · flexible chat · 240px members.
 */
export function DesktopLayout() {
    const membersOpen = useUiStore((state) => state.membersOpen);
    const { channelId } = useChatTarget();
    return (_jsxs("div", { className: "flex h-screen-dvh w-full overflow-hidden bg-base-tertiary", children: [_jsx(ServerRail, {}), _jsx(ChannelSidebar, {}), _jsx(ChatArea, {}), membersOpen && channelId ? _jsx(MemberList, { className: "w-members shrink-0" }) : null] }));
}
//# sourceMappingURL=DesktopLayout.js.map