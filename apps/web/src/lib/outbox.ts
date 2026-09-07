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
  channelId: string;
  createdAt: number;
  status: 'pending' | 'failed';
  payload: OutboxPayload;
}

const KEY = 'tetherchat-outbox';

function read(): OutboxItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(items.slice(-200)));
}

export function listOutbox(channelId?: string): OutboxItem[] {
  const items = read();
  return channelId ? items.filter((item) => item.channelId === channelId) : items;
}

export function putOutbox(item: OutboxItem): void {
  const items = read().filter((entry) => entry.nonce !== item.nonce);
  items.push(item);
  write(items);
}

export function markOutboxFailed(nonce: string): void {
  write(read().map((item) => (item.nonce === nonce ? { ...item, status: 'failed' } : item)));
}

export function removeOutbox(nonce: string): void {
  write(read().filter((item) => item.nonce !== nonce));
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
