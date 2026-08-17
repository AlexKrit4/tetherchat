import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { memberSince } from '@/lib/time';
import { DM_ROUTE, useChatTarget } from '@/hooks/useChatTarget';
import { useCreateConversation } from '@/hooks/useDms';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMembers } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/stores/toastStore';
/** Profile card on desktop, full-height sheet on mobile. */
export function UserProfileDialog({ userId, open, onClose }) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const currentUserId = useAuthStore((state) => state.user?.id);
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const { serverId, server } = useChatTarget();
    const { data: members } = useMembers(serverId);
    const createConversation = useCreateConversation();
    const { data: user, isLoading } = useQuery({
        queryKey: ['user', userId],
        queryFn: () => api.get(`/api/users/${userId}`),
        enabled: open,
    });
    const member = members?.find((entry) => entry.userId === userId);
    const roles = (server?.roles ?? [])
        .filter((role) => !role.isDefault && member?.roleIds.includes(role.id))
        .sort((a, b) => b.position - a.position);
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, width: "sm", children: isLoading || !user ? (_jsx("div", { className: "flex justify-center py-10", children: _jsx(Spinner, {}) })) : (_jsxs("div", { className: "flex flex-col", children: [_jsx("div", { className: "-mx-4 -mt-3 h-[60px]", style: { background: user.bannerColor ?? 'var(--brand)' }, "aria-hidden": true }), _jsx("div", { className: "-mt-8", children: _jsx(Avatar, { user: user, size: 72, showStatus: true, className: "ring-6", ringColor: "var(--bg-primary)" }) }), _jsxs("div", { className: "mt-3 rounded-lg bg-base-tertiary p-3", children: [_jsx("p", { className: "text-xl font-bold text-text-heading", children: member?.nickname ?? user.displayName ?? user.username }), _jsxs("p", { className: "text-base text-text-muted", children: ["@", user.username] }), user.customStatus ? (_jsx("p", { className: "mt-2 text-base text-text", children: user.customStatus })) : null, user.bio ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-3 h-px bg-divider" }), _jsx("p", { className: "text-xs font-bold uppercase tracking-[0.02em] text-text-subheading", children: "About me" }), _jsx("p", { className: "mt-1 whitespace-pre-wrap text-base text-text", children: user.bio })] })) : null, roles.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-3 h-px bg-divider" }), _jsx("p", { className: "text-xs font-bold uppercase tracking-[0.02em] text-text-subheading", children: "Roles" }), _jsx("div", { className: "mt-1.5 flex flex-wrap gap-1.5", children: roles.map((role) => (_jsxs("span", { className: "flex items-center gap-1.5 rounded bg-base-secondary px-2 py-1 text-sm text-text", children: [_jsx("span", { "aria-hidden": true, className: "h-2.5 w-2.5 rounded-full", style: { background: role.color ?? 'var(--grey)' } }), role.name] }, role.id))) })] })) : null, _jsx("div", { className: "my-3 h-px bg-divider" }), _jsx("p", { className: "text-xs font-bold uppercase tracking-[0.02em] text-text-subheading", children: "Member since" }), _jsx("p", { className: "mt-1 text-base text-text", children: memberSince(user.createdAt) }), userId !== currentUserId ? (_jsxs(Button, { fullWidth: true, className: "mt-4", loading: createConversation.isPending, onClick: () => createConversation.mutate({ userIds: [userId] }, {
                                onSuccess: (conversation) => {
                                    navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
                                    if (isMobile)
                                        pushMobileView('chat');
                                    onClose();
                                },
                                onError: (error) => toast.error(errorMessage(error)),
                            }), children: [_jsx(MessageSquare, { size: 16, "aria-hidden": true }), "Send message"] })) : null] })] })) }));
}
//# sourceMappingURL=UserProfileDialog.js.map