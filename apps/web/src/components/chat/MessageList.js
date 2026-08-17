import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { ArrowDown, Hash } from 'lucide-react';
import { Permission, buildMessageEntries, can } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { dayLabel } from '@/lib/time';
import { errorMessage } from '@/lib/api';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMembers } from '@/hooks/useServers';
import { useDeleteMessage, useEditMessage, useMessages, useToggleReaction, useTogglePin, } from '@/hooks/useMessages';
import { useAckChannel, useReadStateIndex } from '@/hooks/useReadStates';
import { useChannelSubscription } from '@/hooks/useRealtime';
import { MessageSkeletonList } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { MessageGroup } from './MessageGroup';
import { MessageActionSheet } from './MessageActionSheet';
import { EmojiPicker } from './EmojiPicker';
import { UserProfileDialog } from '@/components/modals/UserProfileDialog';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/stores/toastStore';
// Virtuoso keeps scroll position stable when firstItemIndex shrinks as older
// pages are prepended, so history loads without the viewport jumping.
const VIRTUOSO_START_INDEX = 1_000_000;
export function MessageList() {
    const isMobile = useIsMobile();
    const { channelId, isDm, server, serverId, title } = useChatTarget();
    const currentUser = useAuthStore((state) => state.user);
    const { data: members } = useMembers(serverId);
    const readStates = useReadStateIndex();
    const ack = useAckChannel();
    const editingMessageId = useUiStore((state) => state.editingMessageId);
    const setEditingMessage = useUiStore((state) => state.setEditingMessage);
    const setReplyDraft = useUiStore((state) => state.setReplyDraft);
    const virtuoso = useRef(null);
    const [atBottom, setAtBottom] = useState(true);
    const [actionSheetFor, setActionSheetFor] = useState(null);
    const [emojiFor, setEmojiFor] = useState(null);
    const [profileFor, setProfileFor] = useState(null);
    useChannelSubscription(channelId);
    const { messages, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMessages(channelId, isDm);
    const editMessage = useEditMessage(channelId ?? '');
    const deleteMessage = useDeleteMessage(channelId ?? '');
    const toggleReaction = useToggleReaction(channelId ?? '');
    const togglePin = useTogglePin(channelId ?? '');
    const memberIndex = useMemo(() => {
        const index = new Map();
        for (const member of members ?? [])
            index.set(member.userId, member);
        return index;
    }, [members]);
    const roleColors = useMemo(() => {
        const colors = new Map();
        if (!server)
            return colors;
        const byPosition = [...server.roles].sort((a, b) => b.position - a.position);
        for (const member of members ?? []) {
            const coloured = byPosition.find((role) => role.color && member.roleIds.includes(role.id) && !role.isDefault);
            if (coloured?.color)
                colors.set(member.userId, coloured.color);
        }
        return colors;
    }, [members, server]);
    const lastReadMessageId = channelId ? readStates.lastReadMessageId(channelId) : null;
    const entries = useMemo(() => buildMessageEntries(messages, {
        lastReadMessageId,
        currentUserId: currentUser?.id,
    }), [currentUser?.id, lastReadMessageId, messages]);
    // Acknowledge the newest message whenever the reader is parked at the bottom.
    useEffect(() => {
        if (!channelId || !atBottom || messages.length === 0)
            return;
        const newest = messages[messages.length - 1];
        if (newest.pending)
            return;
        ack(channelId, newest.id);
    }, [ack, atBottom, channelId, messages]);
    const jumpToBottom = useCallback(() => {
        virtuoso.current?.scrollToIndex({ index: entries.length - 1, behavior: 'smooth' });
    }, [entries.length]);
    const jumpToMessage = useCallback((messageId) => {
        const index = entries.findIndex((entry) => entry.message.id === messageId);
        if (index >= 0)
            virtuoso.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
        else
            toast.info('That message is further back in history');
    }, [entries]);
    const manageMessages = Boolean(server && can(server.permissions, Permission.MANAGE_MESSAGES));
    const canReact = !server || can(server.permissions, Permission.ADD_REACTIONS);
    if (!channelId)
        return _jsx(EmptyChannelState, {});
    if (isLoading)
        return _jsx(MessageSkeletonList, {});
    if (entries.length === 0) {
        return _jsx(ChannelIntro, { name: title, isDm: isDm });
    }
    return (_jsxs("div", { className: "relative min-h-0 flex-1", children: [_jsx(Virtuoso, { ref: virtuoso, className: "scroller scroller-hover h-full", data: entries, firstItemIndex: VIRTUOSO_START_INDEX - entries.length, initialTopMostItemIndex: entries.length - 1, followOutput: (isAtBottom) => (isAtBottom ? 'smooth' : false), atBottomStateChange: setAtBottom, atBottomThreshold: 80, startReached: () => {
                    if (hasNextPage && !isFetchingNextPage)
                        void fetchNextPage();
                }, increaseViewportBy: { top: 600, bottom: 200 }, components: {
                    Header: () => (_jsx("div", { className: "pt-4", children: isFetchingNextPage ? (_jsx("div", { className: "flex justify-center py-4", children: _jsx(Spinner, { className: "h-5 w-5 text-text-muted" }) })) : hasNextPage ? (_jsx("div", { className: "h-4" })) : (_jsx(ChannelIntro, { name: title, isDm: isDm, compact: true })) })),
                    Footer: () => _jsx("div", { className: "h-4" }),
                }, itemContent: (_index, entry) => {
                    const { message } = entry;
                    const mine = message.authorId === currentUser?.id;
                    return (_jsxs("div", { children: [entry.dayDivider ? _jsx(DayDivider, { label: dayLabel(entry.dayDivider) }) : null, entry.unreadDivider ? _jsx(UnreadDivider, {}) : null, _jsx(MessageGroup, { message: message, isGroupStart: entry.isGroupStart, member: memberIndex.get(message.authorId), roleColor: roleColors.get(message.authorId) ?? null, editing: editingMessageId === message.id, mentionsMe: Boolean(currentUser && message.mentionedUserIds.includes(currentUser.id)) ||
                                    message.mentionsEveryone, actions: {
                                    canEdit: mine,
                                    canDelete: mine || manageMessages,
                                    canPin: manageMessages && !isDm,
                                    canReact,
                                }, onReply: (target) => setReplyDraft(channelId, target), onEdit: (target) => setEditingMessage(target.id), onEditCancel: () => setEditingMessage(null), onEditSubmit: (content) => {
                                    editMessage.mutate({ messageId: message.id, content }, { onError: (error) => toast.error(errorMessage(error)) });
                                    setEditingMessage(null);
                                }, onDelete: (target) => deleteMessage.mutate(target.id, {
                                    onError: (error) => toast.error(errorMessage(error)),
                                }), onTogglePin: (target) => togglePin.mutate({ messageId: target.id, pinned: !target.pinned }, { onError: (error) => toast.error(errorMessage(error)) }), onToggleReaction: (emoji) => toggleReaction.mutate({ messageId: message.id, emoji }), onOpenEmojiPicker: () => setEmojiFor(message), onOpenActions: setActionSheetFor, onOpenProfile: setProfileFor, onJumpToMessage: jumpToMessage })] }));
                } }), !atBottom ? (_jsxs("button", { type: "button", onClick: jumpToBottom, className: cn('absolute right-4 flex items-center gap-2 rounded-full bg-base-floating px-3 py-2', 'text-sm font-medium text-text-heading shadow-floating', isMobile ? 'bottom-3' : 'bottom-4'), children: [_jsx(ArrowDown, { size: 16, "aria-hidden": true }), "Jump to present"] })) : null, _jsx(MessageActionSheet, { message: actionSheetFor, onClose: () => setActionSheetFor(null), canEdit: actionSheetFor?.authorId === currentUser?.id, canDelete: actionSheetFor?.authorId === currentUser?.id || manageMessages, canPin: manageMessages && !isDm, onReply: (target) => setReplyDraft(channelId, target), onEdit: (target) => setEditingMessage(target.id), onDelete: (target) => deleteMessage.mutate(target.id, { onError: (error) => toast.error(errorMessage(error)) }), onTogglePin: (target) => togglePin.mutate({ messageId: target.id, pinned: !target.pinned }), onReact: (target, emoji) => toggleReaction.mutate({ messageId: target.id, emoji }), onOpenEmojiPicker: (target) => setEmojiFor(target) }), emojiFor ? (_jsx(EmojiPicker, { open: true, onClose: () => setEmojiFor(null), onSelect: (emoji) => toggleReaction.mutate({ messageId: emojiFor.id, emoji }) })) : null, profileFor ? (_jsx(UserProfileDialog, { userId: profileFor, open: true, onClose: () => setProfileFor(null) })) : null] }));
}
function DayDivider({ label }) {
    return (_jsxs("div", { className: "relative mx-4 my-4 flex items-center justify-center", "aria-hidden": true, children: [_jsx("span", { className: "absolute inset-x-0 top-1/2 h-px bg-divider" }), _jsx("span", { className: "relative bg-base px-2 text-2xs font-semibold text-text-muted", children: label })] }));
}
function UnreadDivider() {
    return (_jsxs("div", { className: "relative mx-4 my-2 flex items-center", role: "separator", children: [_jsx("span", { className: "h-px flex-1 bg-danger" }), _jsx("span", { className: "rounded-b bg-danger px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white", children: "New" })] }));
}
function ChannelIntro({ name, isDm, compact, }) {
    return (_jsxs("div", { className: cn('px-4', compact ? 'pb-4 pt-6' : 'flex h-full flex-col justify-end pb-8'), children: [!isDm ? (_jsx("span", { className: "mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-active", children: _jsx(Hash, { size: 36, strokeWidth: 2, className: "text-text-heading", "aria-hidden": true }) })) : null, _jsx("h2", { className: "text-2xl font-bold text-text-heading", children: isDm ? name : `Welcome to #${name}!` }), _jsx("p", { className: "mt-1 text-base text-text-muted", children: isDm
                    ? 'This is the beginning of your direct message history.'
                    : `This is the start of the #${name} channel.` })] }));
}
function EmptyChannelState() {
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center", children: [_jsx(Hash, { size: 44, className: "text-text-faint", "aria-hidden": true }), _jsx("h2", { className: "text-xl font-semibold text-text-heading", children: "No channel selected" }), _jsx("p", { className: "max-w-[380px] text-base text-text-muted", children: "Pick a channel from the sidebar to start reading." })] }));
}
//# sourceMappingURL=MessageList.js.map