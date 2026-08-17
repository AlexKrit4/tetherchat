import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MemberList } from '@/components/layout/MemberList';
import { MobileHeader } from './MobileHeader';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useUiStore } from '@/stores/uiStore';
export function MobileMembersView() {
    const popMobileView = useUiStore((state) => state.popMobileView);
    const { server, conversation, isDm } = useChatTarget();
    const count = isDm ? (conversation?.members.length ?? 0) : (server?.memberCount ?? 0);
    return (_jsxs("div", { className: "flex h-full flex-col bg-base-secondary", children: [_jsx(MobileHeader, { title: "Members", subtitle: count > 0 ? `${count} total` : undefined, onBack: popMobileView }), _jsx(MemberList, { className: "min-h-0 flex-1 pb-safe", compact: false })] }));
}
//# sourceMappingURL=MobileMembersView.js.map