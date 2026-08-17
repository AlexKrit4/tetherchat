import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { memo, useState } from 'react';
import { CornerUpLeft, Pencil, Pin, Reply, SmilePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { messageTimestamp, shortTime } from '@/lib/time';
import { useHasHover, useIsMobile } from '@/hooks/useMediaQuery';
import { useLongPress } from '@/hooks/useLongPress';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { MessageContent } from './MessageContent';
import { Attachments, LinkPreviews } from './Attachments';
import { Reactions } from './Reactions';
import { MessageEditor } from './MessageEditor';
/**
 * One message row. The first message of a group carries the avatar and the
 * author header; the rest are indented to line up with the text above, which is
 * what gives a Discord channel its dense rhythm.
 */
export const MessageGroup = memo(function MessageGroup({ message, isGroupStart, member, roleColor, actions, editing, mentionsMe, onReply, onEdit, onEditSubmit, onEditCancel, onDelete, onTogglePin, onToggleReaction, onOpenEmojiPicker, onOpenActions, onOpenProfile, onJumpToMessage, }) {
    const isMobile = useIsMobile();
    const hasHover = useHasHover();
    const [hovered, setHovered] = useState(false);
    const longPress = useLongPress(() => onOpenActions(message), { enabled: isMobile });
    const displayName = member?.nickname ?? message.author.displayName ?? message.author.username;
    const avatarSize = isMobile ? 32 : 40;
    const indent = isMobile ? 'pl-[56px]' : 'pl-[72px]';
    if (message.system) {
        return (_jsxs("div", { className: "px-4 py-1 text-sm text-text-muted md:px-4", children: [_jsx("span", { className: "font-medium text-text-subheading", children: displayName }), " ", message.content] }));
    }
    return (_jsxs("div", { ...longPress, onMouseEnter: hasHover ? () => setHovered(true) : undefined, onMouseLeave: hasHover ? () => setHovered(false) : undefined, className: cn('group/message relative px-4 md:px-4', isGroupStart ? 'mt-4 first:mt-0' : 'mt-0.5', mentionsMe && 'bg-mention-bg', hovered && !mentionsMe && 'md:bg-[rgba(2,2,2,0.06)]', message.failed && 'opacity-70'), children: [mentionsMe ? (_jsx("span", { "aria-hidden": true, className: "absolute inset-y-0 left-0 w-0.5 bg-mention-text" })) : null, message.replyTo ? (_jsxs("button", { type: "button", onClick: () => message.replyTo && onJumpToMessage?.(message.replyTo.id), className: cn('mb-1 flex w-full items-center gap-1.5 text-left text-sm text-text-muted', isMobile ? 'pl-[56px]' : 'pl-[72px]'), children: [_jsx(CornerUpLeft, { size: 14, className: "shrink-0 text-text-faint", "aria-hidden": true }), _jsxs("span", { className: "shrink-0 font-medium text-text-subheading", children: ["@", message.replyTo.author?.displayName ?? message.replyTo.author?.username ?? 'unknown'] }), _jsx("span", { className: "truncate opacity-80", children: message.replyTo.deleted ? 'Original message was deleted' : message.replyTo.content })] })) : null, _jsxs("div", { className: "flex gap-4", children: [isGroupStart ? (_jsx("button", { type: "button", onClick: () => onOpenProfile(message.authorId), className: "mt-0.5 shrink-0", "aria-label": `Open ${displayName} profile`, children: _jsx(Avatar, { user: message.author, size: avatarSize }) })) : (_jsx("span", { "aria-hidden": true, className: "shrink-0 select-none pt-0.5 text-right text-2xs leading-[22px] text-text-faint opacity-0 group-hover/message:opacity-100", style: { width: avatarSize }, children: hasHover ? shortTime(message.createdAt) : '' })), _jsxs("div", { className: "min-w-0 flex-1", children: [isGroupStart ? (_jsxs("div", { className: "flex flex-wrap items-baseline gap-2", children: [_jsx("button", { type: "button", onClick: () => onOpenProfile(message.authorId), className: "text-message font-medium hover:underline", style: { color: roleColor ?? 'var(--header-primary)' }, children: displayName }), _jsx(Tooltip, { content: messageTimestamp(message.createdAt), children: _jsx("span", { className: "text-xs text-text-muted", children: messageTimestamp(message.createdAt) }) })] })) : null, editing ? (_jsx(MessageEditor, { initialValue: message.content, onSubmit: onEditSubmit, onCancel: onEditCancel })) : (_jsxs(_Fragment, { children: [message.content ? (_jsxs("div", { className: "flex flex-wrap items-baseline gap-1", children: [_jsx(MessageContent, { content: message.content }), message.editedAt ? (_jsx(Tooltip, { content: messageTimestamp(message.editedAt), children: _jsx("span", { className: "text-2xs text-text-faint", children: "(edited)" }) })) : null, message.pending ? (_jsx("span", { className: "text-2xs text-text-faint", children: "Sending\u2026" })) : null, message.failed ? (_jsx("span", { className: "text-2xs text-danger", children: "Failed to send" })) : null] })) : null, _jsx(Attachments, { attachments: message.attachments }), _jsx(LinkPreviews, { previews: message.previews }), _jsx(Reactions, { reactions: message.reactions, onToggle: onToggleReaction, onAdd: onOpenEmojiPicker, disabled: !actions.canReact })] }))] })] }), hasHover && hovered && !editing ? (_jsxs("div", { className: "absolute -top-4 right-4 z-10 flex items-center gap-0.5 rounded bg-base-secondary p-0.5 shadow-elevated", children: [actions.canReact ? (_jsx(IconButton, { icon: SmilePlus, label: "Add reaction", size: "sm", onClick: onOpenEmojiPicker })) : null, _jsx(IconButton, { icon: Reply, label: "Reply", size: "sm", onClick: () => onReply(message) }), actions.canEdit ? (_jsx(IconButton, { icon: Pencil, label: "Edit", size: "sm", onClick: () => onEdit(message) })) : null, actions.canPin ? (_jsx(IconButton, { icon: Pin, label: message.pinned ? 'Unpin' : 'Pin', size: "sm", active: message.pinned, onClick: () => onTogglePin(message) })) : null, actions.canDelete ? (_jsx(IconButton, { icon: Trash2, label: "Delete", size: "sm", tone: "danger", onClick: () => onDelete(message) })) : null] })) : null] }));
});
//# sourceMappingURL=MessageGroup.js.map