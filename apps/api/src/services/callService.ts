import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import type { CallEndedPayload, CallRingPayload, CallSignalPayload } from '@tetherchat/shared';
import { toCallParticipant } from '@tetherchat/shared';
import type { CallStatus } from '@prisma/client';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { isBlockedEitherWay } from '../lib/blocks.js';
import { areFriends } from '../lib/friends.js';
import { assertConversationMember } from '../lib/permissions.js';
import { publicUserSelect, toPublicUser } from '../lib/serialize.js';
import { enqueue } from '../jobs/queue.js';
import { emitToUser } from '../ws/realtime.js';

const RING_TIMEOUT_MS = 45_000;
const ACTIVE_STATUSES: CallStatus[] = ['ringing', 'active'];
const STALE_RINGING_MS = RING_TIMEOUT_MS + 10_000;
const STALE_ACTIVE_MS = 3 * 60_000;
const BUSY_RETRY_MS = 30_000;

async function forceEndCall(
  call: { id: string; conversationId: string; callerId: string; calleeId: string; status: CallStatus },
  reason: 'ended' | 'missed' = 'ended',
): Promise<void> {
  if (!ACTIVE_STATUSES.includes(call.status)) return;
  const status = call.status === 'ringing' ? 'missed' : 'ended';
  const updated = await prisma.call.update({
    where: { id: call.id },
    data: {
      status: reason === 'missed' && call.status === 'ringing' ? 'missed' : status,
      endedAt: new Date(),
      endReason: reason === 'missed' && call.status === 'ringing' ? 'missed' : 'ended',
    },
  });
  const payload = endedPayload(updated, updated.endReason === 'missed' ? 'missed' : 'ended');
  emitToUser(call.callerId, updated.endReason === 'missed' ? 'call:missed' : 'call:ended', payload);
  emitToUser(call.calleeId, updated.endReason === 'missed' ? 'call:missed' : 'call:ended', payload);
}

/** Ends calls that outlived their client session (crash, failed LiveKit connect, etc.). */
export async function releaseStaleCallsForUser(userId: string): Promise<void> {
  const now = Date.now();
  const open = await prisma.call.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
  });
  await Promise.all(
    open.map(async (call) => {
      const age = now - call.startedAt.getTime();
      if (call.status === 'ringing' && age > STALE_RINGING_MS) {
        await forceEndCall(call, 'missed');
      } else if (call.status === 'active' && age > STALE_ACTIVE_MS) {
        await forceEndCall(call, 'ended');
      }
    }),
  );
}

function livekitPublicUrl(): string {
  return getConfig().PUBLIC_LIVEKIT_URL;
}

async function mintLiveKitToken(userId: string, displayName: string, roomName: string): Promise<string> {
  const config = getConfig();
  if (!config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
    throw ApiError.internal('Звонки не настроены на сервере');
  }
  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: userId,
    name: displayName,
    ttl: '1h',
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  return await token.toJwt();
}

async function loadCall(callId: string) {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      caller: { select: publicUserSelect },
      callee: { select: publicUserSelect },
    },
  });
  if (!call) throw ApiError.notFound('Звонок не найден');
  return call;
}

function assertParticipant(call: { callerId: string; calleeId: string }, userId: string): void {
  if (call.callerId !== userId && call.calleeId !== userId) {
    throw ApiError.forbidden('Вы не участник этого звонка');
  }
}

async function assertCallableConversation(conversationId: string, callerId: string) {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        where: { leftAt: null },
        include: { user: { select: publicUserSelect } },
      },
    },
  });
  if (!conversation) throw ApiError.notFound('Беседа не найдена');
  await assertConversationMember(conversationId, callerId);
  if (conversation.isSaved || conversation.isAi || conversation.isGroup) {
    throw ApiError.badRequest('Звонки доступны только в личных DM');
  }
  const peers = conversation.members.filter((member) => member.userId !== callerId);
  if (peers.length !== 1) throw ApiError.badRequest('Звонок возможен только один на один');
  const callee = peers[0]!;
  if (await isBlockedEitherWay(callerId, callee.userId)) {
    throw ApiError.forbidden('Нельзя позвонить этому пользователю');
  }
  if (!(await areFriends(callerId, callee.userId))) {
    throw ApiError.forbidden('Можно звонить только друзьям');
  }
  return { conversation, callee: callee.user };
}

async function userBusy(userId: string): Promise<boolean> {
  const active = await prisma.call.findFirst({
    where: {
      status: { in: ACTIVE_STATUSES },
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
    select: { id: true, status: true, startedAt: true, callerId: true, calleeId: true, conversationId: true },
  });
  if (!active) return false;
  const age = Date.now() - active.startedAt.getTime();
  if (age > BUSY_RETRY_MS) {
    await forceEndCall(active, active.status === 'ringing' ? 'missed' : 'ended');
    return false;
  }
  return true;
}

function endedPayload(
  call: { id: string; conversationId: string },
  reason: CallEndedPayload['reason'],
): CallEndedPayload {
  return { callId: call.id, conversationId: call.conversationId, reason };
}

function signalPayload(call: { id: string; conversationId: string; roomName: string }): CallSignalPayload {
  return {
    callId: call.id,
    conversationId: call.conversationId,
    roomName: call.roomName,
    livekitUrl: livekitPublicUrl(),
  };
}

async function notifyCallPush(
  calleeId: string,
  payload: {
    callId: string;
    conversationId: string;
    callerName: string;
  },
): Promise<void> {
  await enqueue({
    type: 'push',
    userIds: [calleeId],
    payload: {
      kind: 'call',
      title: 'Входящий звонок',
      body: payload.callerName,
      url: `/channels/@me/${payload.conversationId}?call=${payload.callId}`,
      tag: `call:${payload.callId}`,
      channelId: payload.conversationId,
      callId: payload.callId,
      callerName: payload.callerName,
    },
  });
}

export async function startCall(callerId: string, conversationId: string) {
  await releaseStaleCallsForUser(callerId);
  const { callee } = await assertCallableConversation(conversationId, callerId);
  if (await userBusy(callerId)) throw ApiError.conflict('Вы уже в звонке');
  await releaseStaleCallsForUser(callee.id);
  if (await userBusy(callee.id)) {
    const busyCall = await prisma.call.create({
      data: {
        conversationId,
        roomName: `call-busy-${randomUUID()}`,
        callerId,
        calleeId: callee.id,
        status: 'busy',
        endedAt: new Date(),
        endReason: 'busy',
      },
    });
    emitToUser(callerId, 'call:busy', endedPayload(busyCall, 'busy'));
    throw ApiError.conflict('Пользователь занят');
  }

  const call = await prisma.call.create({
    data: {
      conversationId,
      roomName: `call-${randomUUID()}`,
      callerId,
      calleeId: callee.id,
      status: 'ringing',
    },
    include: { caller: { select: publicUserSelect } },
  });

  const ringPayload: CallRingPayload = {
    callId: call.id,
    conversationId,
    roomName: call.roomName,
    caller: toCallParticipant(toPublicUser(call.caller)),
    startedAt: call.startedAt.toISOString(),
  };
  emitToUser(callee.id, 'call:ring', ringPayload);

  const callerName = call.caller.displayName ?? call.caller.username;
  void notifyCallPush(callee.id, { callId: call.id, conversationId, callerName });

  await enqueue({ type: 'call-timeout', callId: call.id }, { delay: RING_TIMEOUT_MS });

  return {
    callId: call.id,
    roomName: call.roomName,
    livekitUrl: livekitPublicUrl(),
    callee: toCallParticipant(toPublicUser(callee)),
  };
}

export async function acceptCall(userId: string, callId: string) {
  const call = await loadCall(callId);
  if (call.calleeId !== userId) throw ApiError.forbidden('Только получатель может принять звонок');
  if (call.status !== 'ringing') throw ApiError.conflict('Звонок уже завершён');

  const updated = await prisma.call.update({
    where: { id: callId },
    data: { status: 'active', answeredAt: new Date() },
  });

  const payload = signalPayload(updated);
  emitToUser(call.callerId, 'call:accepted', payload);
  emitToUser(call.calleeId, 'call:accepted', payload);
  return payload;
}

export async function declineCall(userId: string, callId: string) {
  const call = await loadCall(callId);
  assertParticipant(call, userId);
  if (call.status !== 'ringing') throw ApiError.conflict('Звонок уже завершён');

  const updated = await prisma.call.update({
    where: { id: callId },
    data: { status: 'declined', endedAt: new Date(), endReason: 'declined' },
  });
  const payload = endedPayload(updated, 'declined');
  emitToUser(call.callerId, 'call:declined', payload);
  emitToUser(call.calleeId, 'call:declined', payload);
  return payload;
}

export async function endCall(userId: string, callId: string) {
  const call = await loadCall(callId);
  assertParticipant(call, userId);
  if (!ACTIVE_STATUSES.includes(call.status)) return endedPayload(call, 'ended');

  const updated = await prisma.call.update({
    where: { id: callId },
    data: { status: 'ended', endedAt: new Date(), endReason: 'ended' },
  });
  const payload = endedPayload(updated, 'ended');
  emitToUser(call.callerId, 'call:ended', payload);
  emitToUser(call.calleeId, 'call:ended', payload);
  return payload;
}

export async function expireRingingCall(callId: string): Promise<void> {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call || call.status !== 'ringing') return;

  const updated = await prisma.call.update({
    where: { id: callId },
    data: { status: 'missed', endedAt: new Date(), endReason: 'missed' },
  });
  const payload = endedPayload(updated, 'missed');
  emitToUser(call.callerId, 'call:missed', payload);
  emitToUser(call.calleeId, 'call:missed', payload);
}

export async function getCallToken(userId: string, callId: string) {
  const call = await loadCall(callId);
  assertParticipant(call, userId);
  if (!ACTIVE_STATUSES.includes(call.status)) {
    throw ApiError.conflict('Звонок не активен');
  }

  const self = call.callerId === userId ? call.caller : call.callee;
  return {
    token: await mintLiveKitToken(userId, self.displayName ?? self.username, call.roomName),
    roomName: call.roomName,
    livekitUrl: livekitPublicUrl(),
  };
}

export async function abandonActiveCall(userId: string): Promise<void> {
  await releaseStaleCallsForUser(userId);
  const active = await prisma.call.findFirst({
    where: {
      status: { in: ACTIVE_STATUSES },
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
    orderBy: { startedAt: 'desc' },
  });
  if (active) await forceEndCall(active, active.status === 'ringing' ? 'missed' : 'ended');
}

export async function getActiveCallForUser(userId: string) {
  await releaseStaleCallsForUser(userId);
  return prisma.call.findFirst({
    where: {
      status: { in: ACTIVE_STATUSES },
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
    orderBy: { startedAt: 'desc' },
  });
}
