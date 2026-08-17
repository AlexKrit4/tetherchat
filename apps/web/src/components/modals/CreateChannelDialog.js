import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Hash } from 'lucide-react';
import { LIMITS } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useCreateChannel } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';
export function CreateChannelDialog({ serverId, categoryId, open, onClose, }) {
    const create = useCreateChannel(serverId);
    const [name, setName] = useState('');
    const [topic, setTopic] = useState('');
    const [error, setError] = useState(null);
    const submit = () => {
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            setError('Give the channel a name');
            return;
        }
        create.mutate({ name: trimmed, categoryId, topic: topic.trim() || null }, {
            onSuccess: (channel) => {
                setName('');
                setTopic('');
                onClose();
                toast.success(`#${channel.name} created`);
            },
            onError: (mutationError) => setError(errorMessage(mutationError)),
        });
    };
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, title: "Create a text channel", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { loading: create.isPending, onClick: submit, children: "Create channel" })] }), children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Input, { label: _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Hash, { size: 12, strokeWidth: 3, "aria-hidden": true }), "Channel name"] }), autoFocus: true, value: name, error: error, maxLength: LIMITS.channelName.max, placeholder: "new-channel", onChange: (event) => {
                        setName(event.target.value.replace(/\s+/g, '-').toLowerCase());
                        setError(null);
                    }, onKeyDown: (event) => {
                        if (event.key === 'Enter')
                            submit();
                    } }), _jsx(Input, { label: "Topic", value: topic, maxLength: LIMITS.channelTopic.max, placeholder: "What is this channel about?", onChange: (event) => setTopic(event.target.value) })] }) }));
}
//# sourceMappingURL=CreateChannelDialog.js.map