import type { Message } from '@tetherchat/shared';

export interface OutboxPayload {
  content: string;
  replyToId?: string | null;
  threadRootId?: string | null;
  attachmentIds?: string[];
  attachmentDurations?: Record<string, number>;
  attachmentSpoilers?: Record<string, boolean>;
  isDm: boolean;
  isSecret: boolean;
}

export interface OutboxItem {
  nonce: string;
  userId: string;
  channelId: string;
  createdAt: number;
  status: 'pending' | 'failed';
  payload: OutboxPayload;
}

const KEY = 'tetherchat-outbox';

function isOutboxItem(value: unknown): value is OutboxItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OutboxItem>;
  return (
    typeof item.nonce === 'string' &&
    item.nonce.length > 0 &&
    typeof item.userId === 'string' &&
    item.userId.length > 0 &&
    typeof item.channelId === 'string' &&
    item.channelId.length > 0 &&
    typeof item.createdAt === 'number' &&
    (item.status === 'pending' || item.status === 'failed') &&
    Boolean(item.payload) &&
    typeof item.payload === 'object'
  );
}

function read(): OutboxItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxItem);
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(-200)));
}

export function listOutbox(userId: string, channelId?: string): OutboxItem[] {
  return read().filter((item) => {
    if (item.userId !== userId) return false;
    return channelId ? item.channelId === channelId : true;
  });
}

export function putOutbox(item: OutboxItem): void {
  if (!item.userId) return;
  const items = read().filter((entry) => entry.nonce !== item.nonce || entry.userId !== item.userId);
  items.push(item);
  write(items);
}

export function markOutboxFailed(nonce: string, userId: string): void {
  write(
    read().map((item) =>
      item.nonce === nonce && item.userId === userId ? { ...item, status: 'failed' } : item,
    ),
  );
}

export function removeOutbox(nonce: string, userId: string): void {
  write(read().filter((item) => !(item.nonce === nonce && item.userId === userId)));
}

export function outboxAsMessage(
  item: OutboxItem,
  author: Message['author'],
): Message {
  return {
    id: `pending-${item.nonce}`,
    channelId: item.channelId,
    serverId: null,
    authorId: author.id,
    author,
    content: item.payload.content,
    createdAt: new Date(item.createdAt).toISOString(),
    editedAt: null,
    pinned: false,
    system: false,
    replyTo: null,
    forwardedFrom: null,
    threadRootId: item.payload.threadRootId ?? null,
    threadReplyCount: 0,
    attachments: [],
    reactions: [],
    previews: [],
    mentionedUserIds: [],
    mentionsEveryone: false,
    pending: item.status === 'pending',
    failed: item.status === 'failed',
    nonce: item.nonce,
    outbox: item.payload,
  };
}
