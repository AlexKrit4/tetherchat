import type { Server as SocketServer } from 'socket.io';
import { socketRooms } from '@tetherchat/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@tetherchat/shared';

export interface SocketData {
  userId: string;
  username: string;
  /** Background notification client: receives events but does not count as "in the app". */
  silent: boolean;
}

export type TypedServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

let ioRef: TypedServer | null = null;

export function setRealtimeServer(io: TypedServer): void {
  ioRef = io;
}

export function realtimeServer(): TypedServer | null {
  return ioRef;
}

type EventName = keyof ServerToClientEvents;

function emit<E extends EventName>(room: string, event: E, ...args: Parameters<ServerToClientEvents[E]>) {
  ioRef?.to(room).emit(event, ...args);
}

export function emitToChannel<E extends EventName>(
  channelId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  emit(socketRooms.channel(channelId), event, ...args);
}

export function emitToConversation<E extends EventName>(
  conversationId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  emit(socketRooms.conversation(conversationId), event, ...args);
}

export function emitToServer<E extends EventName>(
  serverId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  emit(socketRooms.server(serverId), event, ...args);
}

export function emitToUser<E extends EventName>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  emit(socketRooms.user(userId), event, ...args);
}

export function emitToUsers<E extends EventName>(
  userIds: string[],
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  for (const userId of userIds) emitToUser(userId, event, ...args);
}

/** Adds every socket of a user to a room, used when they join a server mid-session. */
export async function joinUserToRoom(userId: string, room: string): Promise<void> {
  if (!ioRef) return;
  const sockets = await ioRef.in(socketRooms.user(userId)).fetchSockets();
  for (const socket of sockets) await socket.join(room);
}

export async function removeUserFromRoom(userId: string, room: string): Promise<void> {
  if (!ioRef) return;
  const sockets = await ioRef.in(socketRooms.user(userId)).fetchSockets();
  for (const socket of sockets) socket.leave(room);
}
