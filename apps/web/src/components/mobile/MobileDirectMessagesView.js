import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { DirectMessageList } from '@/components/layout/DirectMessageList';
import { UserPanel } from '@/components/layout/UserPanel';
import { IconButton } from '@/components/ui/IconButton';
import { NewConversationDialog } from '@/components/modals/NewConversationDialog';
import { MobileHeader } from './MobileHeader';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useUiStore } from '@/stores/uiStore';
export function MobileDirectMessagesView() {
    const navigate = useNavigate();
    const { channelId } = useChatTarget();
    const setMobileView = useUiStore((state) => state.setMobileView);
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const [newOpen, setNewOpen] = useState(false);
    return (_jsxs("div", { className: "flex h-full flex-col bg-base-secondary", children: [_jsx(MobileHeader, { title: "Direct Messages", onBack: () => setMobileView('servers'), actions: _jsx(IconButton, { icon: PenSquare, label: "New conversation", size: "lg", showTooltip: false, onClick: () => setNewOpen(true) }) }), _jsx("div", { className: "scroller flex-1", children: _jsx(DirectMessageList, { activeConversationId: channelId, compact: false, onSelect: (conversation) => {
                        navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
                        pushMobileView('chat');
                    } }) }), _jsx(UserPanel, { className: "pb-safe" }), _jsx(NewConversationDialog, { open: newOpen, onClose: () => setNewOpen(false) })] }));
}
//# sourceMappingURL=MobileDirectMessagesView.js.map