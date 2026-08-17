import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { Channel, DirectConversation, ServerDetail } from '@tetherchat/shared';
import { useConversation, conversationTitle } from './useDms';
import { useServer } from './useServers';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/i18n/useT';

export const DM_ROUTE = '@me';

export interface ChatTarget {
  /** Route param: a server id or the literal "@me" for direct messages. */
  serverId: string | undefined;
  isDm: boolean;
  /** Channel id for guilds, conversation id for DMs — both address messages. */
  channelId: string | undefined;
  channel: Channel | undefined;
  conversation: DirectConversation | undefined;
  server: ServerDetail | undefined;
  title: string;
  topic: string | null;
  loading: boolean;
}

/** Single source of truth for "what am I looking at", derived from the URL. */
export function useChatTarget(): ChatTarget {
  const t = useT();
  const params = useParams<{ serverId?: string; channelId?: string }>();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const isDm = params.serverId === DM_ROUTE;
  const serverQuery = useServer(isDm ? undefined : params.serverId);
  const conversationQuery = useConversation(isDm ? params.channelId : undefined);

  const channel = useMemo(
    () => serverQuery.data?.channels.find((entry) => entry.id === params.channelId),
    [params.channelId, serverQuery.data],
  );

  const conversation = conversationQuery.data;

  const title = isDm
    ? conversation
      ? conversationTitle(conversation, currentUserId)
      : t('nav.directMessages')
    : (channel?.name ?? '');

  return {
    serverId: params.serverId,
    isDm,
    channelId: params.channelId,
    channel,
    conversation,
    server: serverQuery.data,
    title,
    topic: isDm ? null : (channel?.topic ?? null),
    loading: isDm ? conversationQuery.isLoading : serverQuery.isLoading,
  };
}

/** Channels grouped under their category, in the order the sidebar renders them. */
export interface ChannelGroup {
  id: string;
  name: string | null;
  channels: Channel[];
}

export function groupChannels(server: ServerDetail | undefined): ChannelGroup[] {
  if (!server) return [];

  const categories = [...server.categories].sort((a, b) => a.position - b.position);
  const byPosition = (a: Channel, b: Channel) => a.position - b.position;

  const uncategorised = server.channels.filter((channel) => !channel.categoryId).sort(byPosition);

  const groups: ChannelGroup[] = uncategorised.length
    ? [{ id: 'uncategorised', name: null, channels: uncategorised }]
    : [];

  for (const category of categories) {
    groups.push({
      id: category.id,
      name: category.name,
      channels: server.channels.filter((channel) => channel.categoryId === category.id).sort(byPosition),
    });
  }

  return groups;
}

/** First visible channel, used when a server is opened without a channel in the URL. */
export function firstChannelId(server: ServerDetail | undefined): string | undefined {
  const groups = groupChannels(server);
  for (const group of groups) {
    if (group.channels.length > 0) return group.channels[0].id;
  }
  return undefined;
}
