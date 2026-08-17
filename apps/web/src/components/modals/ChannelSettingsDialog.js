import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { LIMITS } from '@tetherchat/shared';
import { errorMessage } from '@/lib/api';
import { useDeleteChannel, useUpdateChannel } from '@/hooks/useServers';
import { AdaptiveDialog } from '@/components/ui/AdaptiveDialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';
export function ChannelSettingsDialog({ server, channel, open, onClose, }) {
    const update = useUpdateChannel(server.id);
    const remove = useDeleteChannel(server.id);
    const [name, setName] = useState(channel.name);
    const [topic, setTopic] = useState(channel.topic ?? '');
    const [confirmDelete, setConfirmDelete] = useState(false);
    return (_jsx(AdaptiveDialog, { open: open, onClose: onClose, title: `#${channel.name}`, footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { loading: update.isPending, onClick: () => update.mutate({ channelId: channel.id, name: name.trim(), topic: topic.trim() || null }, {
                        onSuccess: () => {
                            onClose();
                            toast.success('Channel updated');
                        },
                        onError: (error) => toast.error(errorMessage(error)),
                    }), children: "Save changes" })] }), children: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Input, { label: "Channel name", value: name, maxLength: LIMITS.channelName.max, onChange: (event) => setName(event.target.value.replace(/\s+/g, '-').toLowerCase()) }), _jsx(Textarea, { label: "Channel topic", rows: 3, value: topic, maxLength: LIMITS.channelTopic.max, placeholder: "Let people know what this channel is for.", onChange: (event) => setTopic(event.target.value) }), _jsx("div", { className: "h-px bg-divider" }), confirmDelete ? (_jsxs("div", { className: "flex flex-col gap-2 rounded-lg bg-[rgba(242,63,67,0.08)] p-3", children: [_jsxs("p", { className: "text-base text-text", children: ["Delete ", _jsxs("strong", { children: ["#", channel.name] }), " and all of its messages? This cannot be undone."] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setConfirmDelete(false), children: "Keep channel" }), _jsx(Button, { variant: "danger", size: "sm", loading: remove.isPending, onClick: () => remove.mutate(channel.id, {
                                        onSuccess: () => {
                                            onClose();
                                            toast.success('Channel deleted');
                                        },
                                        onError: (error) => toast.error(errorMessage(error)),
                                    }), children: "Delete channel" })] })] })) : (_jsx(Button, { variant: "danger", onClick: () => setConfirmDelete(true), children: "Delete channel" }))] }) }));
}
//# sourceMappingURL=ChannelSettingsDialog.js.map