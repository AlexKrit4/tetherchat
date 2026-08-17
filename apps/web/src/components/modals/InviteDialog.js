import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { useCreateInvite } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toastStore';
/** Invites resolve to tetherchat.ru/invite/<code> in production. */
export function InviteDialog({ server, open, onClose }) {
    const createInvite = useCreateInvite(server.id);
    const [code, setCode] = useState(null);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!open || code)
            return;
        createInvite.mutate({}, {
            onSuccess: (invite) => setCode(invite.code),
            onError: (error) => toast.error(errorMessage(error)),
        });
        // Creating the invite once per open is intentional.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    const link = code ? `${window.location.origin}/invite/${code}` : '';
    const copy = async () => {
        if (!link)
            return;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
        }
        catch {
            toast.error('Could not copy — select the link and copy manually');
        }
    };
    return (_jsx(AdaptiveDialog, { open: open, onClose: () => {
            setCode(null);
            onClose();
        }, title: `Invite people to ${server.name}`, description: "Share this link with anyone you want to join.", width: "md", children: _jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 rounded-lg bg-base-tertiary p-2", children: [_jsx("input", { readOnly: true, value: link, "aria-label": "Invite link", className: "min-w-0 flex-1 bg-transparent px-1 text-base text-text outline-none" }), _jsxs(Button, { size: "sm", onClick: () => void copy(), disabled: !link, children: [copied ? _jsx(Check, { size: 16, "aria-hidden": true }) : _jsx(Copy, { size: 16, "aria-hidden": true }), copied ? 'Copied' : 'Copy'] })] }), _jsxs("button", { type: "button", onClick: () => createInvite.mutate({}, {
                        onSuccess: (invite) => {
                            setCode(invite.code);
                            toast.success('New invite generated');
                        },
                        onError: (error) => toast.error(errorMessage(error)),
                    }), className: "flex items-center gap-1.5 self-start text-sm text-text-link hover:underline", children: [_jsx(RefreshCw, { size: 14, "aria-hidden": true }), "Generate a new link"] })] }) }));
}
//# sourceMappingURL=InviteDialog.js.map