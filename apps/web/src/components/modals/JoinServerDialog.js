import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '@/lib/api';
import { useJoinServer } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/stores/uiStore';
/** Accepts a bare code or a full tetherchat.ru/invite/<code> link. */
function extractCode(value) {
    const trimmed = value.trim();
    const match = /invite\/([a-zA-Z0-9-]+)/.exec(trimmed);
    return (match ? match[1] : trimmed).replace(/[^a-zA-Z0-9-]/g, '');
}
export function JoinServerDialog({ open, onClose }) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const pushMobileView = useUiStore((state) => state.pushMobileView);
    const join = useJoinServer();
    const [value, setValue] = useState('');
    const [error, setError] = useState(null);
    const submit = () => {
        const code = extractCode(value);
        if (code.length < 4) {
            setError('Paste an invite link or code');
            return;
        }
        join.mutate(code, {
            onSuccess: ({ serverId }) => {
                navigate(`/channels/${serverId}`);
                if (isMobile)
                    pushMobileView('channels');
                setValue('');
                onClose();
                toast.success('Joined the server');
            },
            onError: (mutationError) => setError(errorMessage(mutationError)),
        });
    };
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, title: "Join a server", description: "Enter an invite below to join an existing server.", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { loading: join.isPending, onClick: submit, children: "Join" })] }), children: _jsx(Input, { label: "Invite link", autoFocus: true, value: value, error: error, placeholder: "https://tetherchat.ru/invite/friendos", onChange: (event) => {
                setValue(event.target.value);
                setError(null);
            }, onKeyDown: (event) => {
                if (event.key === 'Enter')
                    submit();
            } }) }));
}
//# sourceMappingURL=JoinServerDialog.js.map