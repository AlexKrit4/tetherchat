import { Hash, Bookmark, Shield, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Message, ServerDetail } from '@tetherchat/shared';
import { Permission, can } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { conversationTitle, useConversations } from '@/hooks/useDms';
import { conversationNeedsFriendship, isFriendOf, useFriends } from '@/hooks/useFriends';
import { useServers } from '@/hooks/useServers';
import { messagesPath, useNonce } from '@/hooks/useMessages';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useT } from '@/i18n/useT';

export function ForwardDialog({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  const t = useT();
  const client = useQueryClient();
  const nonce = useNonce();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: conversations } = useConversations();
  const { data: friends } = useFriends();
  const { data: servers } = useServers();
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<ServerDetail[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!message) {
      setQuery('');
      return;
    }
    if (!servers?.length) {
      setDetails([]);
      return;
    }
    let cancelled = false;
    void Promise.all(servers.map((server) => api.get<ServerDetail>(`/api/servers/${server.id}`))).then(
      (rows) => {
        if (!cancelled) setDetails(rows);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [message, servers]);

  const targets = useMemo(() => {
    const term = query.trim().toLowerCase();
    const dms = (conversations ?? [])
      .filter((conversation) => {
        if (!conversationNeedsFriendship(conversation)) return true;
        const peer = conversation.members.find((member) => member.id !== currentUserId);
        return isFriendOf(friends, peer?.id);
      })
      .map((conversation) => ({
        id: conversation.id,
        dm: true,
        title: conversationTitle(conversation, currentUserId, t('dm.savedMessages'), t('dm.aiChat'), t('dm.vpnChat')),
        hint: conversation.isSaved
          ? t('dm.savedHint')
          : conversation.isAi
            ? t('dm.aiHint')
            : conversation.isVpn
              ? t('dm.vpnHint')
              : conversation.isGroup
                ? t('server.membersCount', { count: conversation.members.length })
                : t('dm.conversation'),
        saved: Boolean(conversation.isSaved),
        ai: Boolean(conversation.isAi),
        vpn: Boolean(conversation.isVpn),
      }));
    const channels = details.flatMap((server) =>
      server.channels
        .filter(() => can(server.permissions, Permission.SEND_MESSAGES))
        .map((channel) => ({
          id: channel.id,
          dm: false,
          title: `#${channel.name}`,
          hint: server.name,
          saved: false,
          ai: false,
          vpn: false,
        })),
    );
    return [...dms, ...channels]
      .filter((target) => !term || `${target.title} ${target.hint}`.toLowerCase().includes(term))
      .sort((a, b) => Number(b.saved) - Number(a.saved) || Number(b.ai) - Number(a.ai) || Number(b.vpn) - Number(a.vpn));
  }, [conversations, currentUserId, details, friends, query, t]);

  const sendTo = async (target: { id: string; dm: boolean }) => {
    if (!message) return;
    setBusyId(target.id);
    try {
      await api.post(messagesPath(target.id, target.dm), {
        content: '',
        forwardMessageId: message.id,
        nonce: nonce(),
      });
      void client.invalidateQueries({ queryKey: queryKeys.messages(target.id) });
      toast.success(t('chat.forwarded'));
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={Boolean(message)} onClose={onClose} title={t('chat.forwardTo')} width="sm">
      <div className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.search')}
        />
        <ul className="scroller max-h-[360px] flex flex-col gap-0.5">
          {targets.map((target) => (
            <li key={`${target.dm ? 'dm' : 'ch'}:${target.id}`}>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => void sendTo(target)}
                className="flex min-h-11 w-full items-center gap-3 rounded px-2 text-left hover:bg-surface-hover disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-text-muted">
                  {target.saved ? (
                    <Bookmark size={16} />
                  ) : target.ai ? (
                    <Sparkles size={16} />
                  ) : target.vpn ? (
                    <Shield size={16} />
                  ) : target.dm ? null : (
                    <Hash size={16} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-text-heading">{target.title}</span>
                  <span className="block truncate text-xs text-text-muted">{target.hint}</span>
                </span>
              </button>
            </li>
          ))}
          {targets.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-text-muted">{t('chat.forwardEmpty')}</li>
          ) : null}
        </ul>
      </div>
    </Modal>
  );
}
