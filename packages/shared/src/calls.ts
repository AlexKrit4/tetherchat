import type { PublicUser } from './types.js';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'busy';

export interface CallParticipant {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface CallRingPayload {
  callId: string;
  conversationId: string;
  roomName: string;
  caller: CallParticipant;
  startedAt: string;
}

export interface CallSignalPayload {
  callId: string;
  conversationId: string;
  roomName: string;
  livekitUrl: string;
}

export interface CallEndedPayload {
  callId: string;
  conversationId: string;
  reason: 'ended' | 'declined' | 'missed' | 'busy';
}

export function toCallParticipant(user: PublicUser): CallParticipant {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}
