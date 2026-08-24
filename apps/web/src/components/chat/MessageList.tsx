import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { ArrowDown, Hash } from 'lucide-react';
import { Permission, buildMessageEntries, can } from '@tetherchat/shared';
import type { Message, ServerMember } from '@tetherchat/shared';
import { cn } from '@/lib/cn';
import { dayLabel } from '@/lib/time';
import { errorMessage } from '@/lib/api';
import { useChatTarget } from '@/hooks/useChatTarget';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import { useMembers } from '@/hooks/useServers';
import {
  useDeleteMessage,
  useEditMessage,
  useMessages,
  useToggleReaction,
  useTogglePin,
} from '@/hooks/useMessages';
import { useAckChannel, useReadStateIndex } from '@/hooks/useReadStates';
import { useChannelSubscription } from '@/hooks/useRealtime';
import { MessageSkeletonList } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { MessageGroup } from './MessageGroup';
import { MessageActionSheet } from './MessageActionSheet';
import { ForwardDialog } from './ForwardDialog';
import { ReportDialog } from './ReportDialog';
import { EmojiPicker } from './EmojiPicker';
import { UserProfileDialog } from '@/components/modals/UserProfileDialog';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/stores/toastStore';
import { useT } from '@/i18n/useT';

// Virtuoso keeps scroll position stable when firstItemIndex shrinks as older
// pages are prepended, so history loads without the viewport jumping.
const VIRTUOSO_START_INDEX = 1_000_000;

export function MessageList() {
  const t = useT();
  const isMobile = useIsMobile();
  const { offset: keyboardOffset } = useMobileKeyboard();
  const { channelId, isDm, server, serverId, title, conversation } = useChatTarget();
  const currentUser = useAuthStore((state) => state.user);
  const { data: members } = useMembers(serverId);
  const readStates = useReadStateIndex();
  const ack = useAckChannel();
  const isSecret = Boolean(conversation?.isSecret);

  const editingMessageId = useUiStore((state) => state.editingMessageId);
  const setEditingMessage = useUiStore((state) => state.setEditingMessage);
  const setReplyDraft = useUiStore((state) => state.setReplyDraft);

  const virtuoso = useRef<VirtuosoHandle>(null);
  const atBottomRef = useRef(true);
  const entriesLengthRef = useRef(0);
  const loadingHistoryRef = useRef(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollBottomNonce = useUiStore((state) => state.scrollBottomNonce);
  const [actionSheetFor, setActionSheetFor] = useState<Message | null>(null);
  const [forwardFor, setForwardFor] = useState<Message | null>(null);
  const [reportFor, setReportFor] = useState<Message | null>(null);
  const [emojiFor, setEmojiFor] = useState<Message | null>(null);
  const [profileFor, setProfileFor] = useState<string | null>(null);

  useChannelSubscription(channelId);

  const { messages, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMessages(
    channelId,
    isDm,
    isSecret,
  );

  const editMessage = useEditMessage(channelId ?? '');
  const deleteMessage = useDeleteMessage(channelId ?? '');
  const toggleReaction = useToggleReaction(channelId ?? '');
  const togglePin = useTogglePin(channelId ?? '');

  const memberIndex = useMemo(() => {
    const index = new Map<string, ServerMember>();
    for (const member of members ?? []) index.set(member.userId, member);
    return index;
  }, [members]);

  const roleColors = useMemo(() => {
    const colors = new Map<string, string>();
    if (!server) return colors;
    const byPosition = [...server.roles].sort((a, b) => b.position - a.position);
    for (const member of members ?? []) {
      const coloured = byPosition.find(
        (role) => role.color && member.roleIds.includes(role.id) && !role.isDefault,
      );
      if (coloured?.color) colors.set(member.userId, coloured.color);
    }
    return colors;
  }, [members, server]);

  const lastReadMessageId = channelId ? readStates.lastReadMessageId(channelId) : null;

  const entries = useMemo(
    () =>
      buildMessageEntries(messages, {
        lastReadMessageId,
        currentUserId: currentUser?.id,
      }),
    [currentUser?.id, lastReadMessageId, messages],
  );
  entriesLengthRef.current = entries.length;

  // Acknowledge the newest message whenever the reader is parked at the bottom.
  useEffect(() => {
    if (!channelId || !atBottom || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    if (newest.pending) return;
    ack(channelId, newest.id, isDm);
  }, [ack, atBottom, channelId, isDm, messages]);

  const jumpToBottom = useCallback(() => {
    const last = Math.max(0, entriesLengthRef.current - 1);
    virtuoso.current?.scrollToIndex({ index: last, align: 'end', behavior: 'auto' });
  }, []);

  const stickToBottom = useCallback(() => {
    jumpToBottom();
    requestAnimationFrame(() => {
      jumpToBottom();
      window.setTimeout(jumpToBottom, 50);
    });
  }, [jumpToBottom]);

  useEffect(() => {
    atBottomRef.current = true;
    setAtBottom(true);
    loadingHistoryRef.current = false;
  }, [channelId]);

  useEffect(() => {
    if (isFetchingNextPage) loadingHistoryRef.current = true;
  }, [isFetchingNextPage]);

  useEffect(() => {
    if (!loadingHistoryRef.current) return;
    if (!isFetchingNextPage) loadingHistoryRef.current = false;
  }, [isFetchingNextPage, entries.length]);

  useEffect(() => {
    if (!atBottomRef.current || loadingHistoryRef.current) return;
    stickToBottom();
  }, [keyboardOffset, stickToBottom]);

  useEffect(() => {
    if (scrollBottomNonce === 0) return;
    atBottomRef.current = true;
    setAtBottom(true);
    loadingHistoryRef.current = false;
    stickToBottom();
  }, [scrollBottomNonce, stickToBottom]);

  const newestId = messages[messages.length - 1]?.id;
  const newestMine = messages[messages.length - 1]?.authorId === currentUser?.id;
  useEffect(() => {
    if (!newestId || loadingHistoryRef.current) return;
    if (newestMine || atBottomRef.current) {
      atBottomRef.current = true;
      setAtBottom(true);
      stickToBottom();
    }
  }, [newestId, newestMine, stickToBottom]);

  const lastEntry = entries[entries.length - 1];
  useEffect(() => {
    if (!atBottomRef.current || loadingHistoryRef.current || !lastEntry) return;
    stickToBottom();
  }, [
    lastEntry?.message.id,
    lastEntry?.message.updatedAt,
    lastEntry?.message.reactions.length,
    lastEntry?.message.attachments.length,
    stickToBottom,
  ]);

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const index = entries.findIndex((entry) => entry.message.id === messageId);
      if (index >= 0) virtuoso.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
      else toast.info(t('chat.historyFar'));
    },
    [entries],
  );

  const manageMessages = Boolean(server && can(server.permissions, Permission.MANAGE_MESSAGES));
  const canReact = !server || can(server.permissions, Permission.ADD_REACTIONS);

  if (!channelId) return <EmptyChannelState />;
  if (isLoading) return <MessageSkeletonList />;

  if (entries.length === 0) {
    return <ChannelIntro name={title} isDm={isDm} isAi={Boolean(conversation?.isAi)} />;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <Virtuoso
        key={channelId}
        ref={virtuoso}
        className="scroller scroller-hover h-full"
        data={entries}
        firstItemIndex={VIRTUOSO_START_INDEX - entries.length}
        initialTopMostItemIndex={entries.length - 1}
        // Short histories rest against the composer instead of floating at the top.
        alignToBottom
        followOutput={() => (atBottomRef.current ? 'auto' : false)}
        atBottomStateChange={(bottom) => {
          atBottomRef.current = bottom;
          setAtBottom(bottom);
        }}
        atBottomThreshold={Math.max(140, keyboardOffset + 120)}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            loadingHistoryRef.current = true;
            void fetchNextPage();
          }
        }}
        increaseViewportBy={{ top: 600, bottom: 320 }}
        components={{
          Header: () => (
            <div className="pt-4">
              {isFetchingNextPage ? (
                <div className="flex justify-center py-4">
                  <Spinner className="h-5 w-5 text-text-muted" />
                </div>
              ) : hasNextPage ? (
                <div className="h-4" />
              ) : (
                <ChannelIntro name={title} isDm={isDm} isAi={Boolean(conversation?.isAi)} compact />
              )}
            </div>
          ),
          Footer: () => <div className="h-10 shrink-0" aria-hidden />,
        }}
        itemContent={(_index, entry) => {
          const { message } = entry;
          const mine = message.authorId === currentUser?.id;
          const showReceipts =
            Boolean(mine && isDm && conversation && !conversation.isGroup && !conversation.isSaved && !conversation.isAi);
          const read =
            showReceipts &&
            Boolean(
              conversation?.peerLastReadAt && conversation.peerLastReadAt >= message.createdAt,
            );

          return (
            <div>
              {entry.dayDivider ? <DayDivider label={dayLabel(entry.dayDivider)} /> : null}
              {entry.unreadDivider ? <UnreadDivider /> : null}

              <MessageGroup
                message={message}
                isGroupStart={entry.isGroupStart}
                member={memberIndex.get(message.authorId)}
                roleColor={roleColors.get(message.authorId) ?? null}
                editing={editingMessageId === message.id}
                mentionsMe={
                  Boolean(currentUser && message.mentionedUserIds.includes(currentUser.id)) ||
                  message.mentionsEveryone
                }
                actions={{
                  canEdit: mine && !isSecret,
                  canDelete: mine || manageMessages,
                  canPin: manageMessages && !isDm,
                  canReact,
                }}
                onReply={(target) =>
                  isSecret ? toast.error('Ответы пока недоступны в секретном чате') : setReplyDraft(channelId, target)
                }
                onEdit={(target) => setEditingMessage(target.id)}
                onEditCancel={() => setEditingMessage(null)}
                onEditSubmit={(content) => {
                  editMessage.mutate(
                    { messageId: message.id, content },
                    { onError: (error) => toast.error(errorMessage(error)) },
                  );
                  setEditingMessage(null);
                }}
                onDelete={(target) =>
                  deleteMessage.mutate(target.id, {
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
                onTogglePin={(target) =>
                  togglePin.mutate(
                    { messageId: target.id, pinned: !target.pinned },
                    { onError: (error) => toast.error(errorMessage(error)) },
                  )
                }
                onToggleReaction={(emoji) => toggleReaction.mutate({ messageId: message.id, emoji })}
                onOpenEmojiPicker={() => setEmojiFor(message)}
                onOpenActions={setActionSheetFor}
                onOpenProfile={setProfileFor}
                onJumpToMessage={jumpToMessage}
                onForward={isSecret ? undefined : setForwardFor}
                onReport={mine || isSecret ? undefined : setReportFor}
                receipt={
                  showReceipts && !message.pending && !message.failed
                    ? read
                      ? 'read'
                      : 'delivered'
                    : null
                }
              />
            </div>
          );
        }}
      />

      {!atBottom ? (
        <button
          type="button"
          onClick={jumpToBottom}
          className={cn(
            'absolute right-4 flex items-center gap-2 rounded-full bg-surface-floating px-3 py-2',
            'text-sm font-medium text-text-heading shadow-floating',
            isMobile ? 'bottom-3' : 'bottom-4',
          )}
        >
          <ArrowDown size={16} aria-hidden />
          {t('chat.jumpToPresent')}
        </button>
      ) : null}

      {/* Long-press sheet: the touch equivalent of the desktop hover toolbar. */}
      <MessageActionSheet
        message={actionSheetFor}
        onClose={() => setActionSheetFor(null)}
        canEdit={!isSecret && actionSheetFor?.authorId === currentUser?.id}
        canDelete={actionSheetFor?.authorId === currentUser?.id || manageMessages}
        canPin={manageMessages && !isDm}
        onReply={(target) =>
          isSecret ? toast.error('Ответы пока недоступны в секретном чате') : setReplyDraft(channelId, target)
        }
        onForward={isSecret ? undefined : setForwardFor}
        onEdit={(target) => setEditingMessage(target.id)}
        onDelete={(target) =>
          deleteMessage.mutate(target.id, { onError: (error) => toast.error(errorMessage(error)) })
        }
        onTogglePin={(target) => togglePin.mutate({ messageId: target.id, pinned: !target.pinned })}
        onReact={(target, emoji) => toggleReaction.mutate({ messageId: target.id, emoji })}
        onOpenEmojiPicker={(target) => setEmojiFor(target)}
        onReport={
          !isSecret && actionSheetFor && actionSheetFor.authorId !== currentUser?.id ? setReportFor : undefined
        }
      />

      <ForwardDialog message={forwardFor} onClose={() => setForwardFor(null)} />
      <ReportDialog message={reportFor} onClose={() => setReportFor(null)} />

      {emojiFor ? (
        <EmojiPicker
          open
          onClose={() => setEmojiFor(null)}
          onSelect={(emoji) => toggleReaction.mutate({ messageId: emojiFor.id, emoji })}
        />
      ) : null}

      {profileFor ? (
        <UserProfileDialog userId={profileFor} open onClose={() => setProfileFor(null)} />
      ) : null}
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="relative mx-4 my-4 flex items-center justify-center" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px bg-divider" />
      <span className="relative bg-surface px-2 text-2xs font-semibold text-text-muted">{label}</span>
    </div>
  );
}

function UnreadDivider() {
  const t = useT();
  return (
    <div className="relative mx-4 my-2 flex items-center" role="separator">
      <span className="h-px flex-1 bg-danger" />
      <span className="rounded-b bg-danger px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white">
        {t('chat.unread')}
      </span>
    </div>
  );
}

function ChannelIntro({
  name,
  isDm,
  isAi,
  compact,
}: {
  name: string;
  isDm: boolean;
  isAi?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div className={cn('px-4', compact ? 'pb-4 pt-6' : 'flex h-full flex-col justify-end pb-8')}>
      {!isDm ? (
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-active">
          <Hash size={36} strokeWidth={2} className="text-text-heading" aria-hidden />
        </span>
      ) : null}
      <h2 className="text-2xl font-bold text-text-heading">
        {isDm ? name : t('chat.welcomeChannel', { name })}
      </h2>
      <p className="mt-1 text-base text-text-muted">
        {isAi ? t('chat.startAi') : isDm ? t('chat.startDm') : t('chat.startChannel', { name })}
      </p>
    </div>
  );
}

function EmptyChannelState() {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <Hash size={44} className="text-text-faint" aria-hidden />
      <h2 className="text-xl font-semibold text-text-heading">{t('chat.noChannel')}</h2>
      <p className="max-w-[380px] text-base text-text-muted">{t('chat.pickChannel')}</p>
    </div>
  );
}
