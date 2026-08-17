import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { LIMITS } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { useCreateConversation, useUserSearch } from '@/hooks/useDms';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
/** Pick one person for a DM or several for a group conversation. */
export function NewConversationDialog({ open, onClose }) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const create = useCreateConversation();
    const [term, setTerm] = useState('');
    const [debounced, setDebounced] = useState('');
    const [selected, setSelected] = useState([]);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(term), 250);
        return () => window.clearTimeout(timer);
    }, [term]);
    useEffect(() => {
        if (!open) {
            setTerm('');
            setSelected([]);
        }
    }, [open]);
    const { data: results, isFetching } = useUserSearch(debounced);
    const selectedIds = useMemo(() => new Set(selected.map((user) => user.id)), [selected]);
    const limitReached = selected.length >= LIMITS.groupDmMembers - 1;
    const submit = () => {
        if (selected.length === 0)
            return;
        create.mutate({ userIds: selected.map((user) => user.id) }, {
            onSuccess: (conversation) => {
                navigate(`/channels/${DM_ROUTE}/${conversation.id}`);
                if (isMobile)
                    pushMobileView('chat');
                onClose();
            },
            onError: (error) => toast.error(errorMessage(error)),
        });
    };
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, title: "New conversation", description: `Add up to ${LIMITS.groupDmMembers - 1} people to start a group.`, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { loading: create.isPending, disabled: selected.length === 0, onClick: submit, children: selected.length > 1 ? 'Create group' : 'Open conversation' })] }), children: _jsxs("div", { className: "flex flex-col gap-3", children: [selected.length > 0 ? (_jsx("ul", { className: "flex flex-wrap gap-1.5", children: selected.map((user) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelected((current) => current.filter((entry) => entry.id !== user.id)), className: "flex min-h-8 items-center gap-1.5 rounded bg-base-tertiary px-2 text-sm text-text", children: [user.displayName ?? user.username, _jsx(X, { size: 14, "aria-hidden": true })] }) }, user.id))) })) : null, _jsx(Input, { label: "Find people", autoFocus: true, value: term, placeholder: "Type a username", onChange: (event) => setTerm(event.target.value) }), _jsx("div", { className: "min-h-[120px]", children: isFetching ? (_jsx("div", { className: "flex justify-center py-6", children: _jsx(Spinner, {}) })) : debounced.trim().length < 2 ? (_jsx("p", { className: "py-6 text-center text-sm text-text-muted", children: "Type at least two characters to search." })) : results && results.length > 0 ? (_jsx("ul", { className: "flex flex-col gap-0.5", children: results.map((user) => {
                            const picked = selectedIds.has(user.id);
                            return (_jsx("li", { children: _jsxs("button", { type: "button", disabled: !picked && limitReached, onClick: () => setSelected((current) => picked
                                        ? current.filter((entry) => entry.id !== user.id)
                                        : [...current, user]), className: cn('flex min-h-12 w-full items-center gap-3 rounded px-2 text-left md:min-h-11', 'hover:bg-surface-hover disabled:opacity-40'), children: [_jsx(Avatar, { user: user, size: 32, showStatus: true }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("span", { className: "truncate text-base text-text-heading", children: user.displayName ?? user.username }), _jsxs("span", { className: "truncate text-sm text-text-muted", children: ["@", user.username] })] }), _jsx("span", { className: cn('flex h-5 w-5 shrink-0 items-center justify-center rounded', picked ? 'bg-brand text-white' : 'bg-base-tertiary'), children: picked ? _jsx(Check, { size: 14, "aria-hidden": true }) : null })] }) }, user.id));
                        }) })) : (_jsx("p", { className: "py-6 text-center text-sm text-text-muted", children: "Nobody matched that search." })) })] }) }));
}
//# sourceMappingURL=NewConversationDialog.js.map