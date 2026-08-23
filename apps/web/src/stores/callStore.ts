import { create } from 'zustand';
import type { CallParticipant, CallRingPayload, CallSignalPayload } from '@tetherchat/shared';
import { api } from '@/lib/api';

export type CallPhase = 'idle' | 'outgoing' | 'ringing' | 'connecting' | 'active' | 'ended';

interface CallState {
  phase: CallPhase;
  callId: string | null;
  conversationId: string | null;
  roomName: string | null;
  livekitUrl: string | null;
  token: string | null;
  peer: CallParticipant | null;
  muted: boolean;
  error: string | null;
  startOutgoing: (conversationId: string) => Promise<void>;
  handleRing: (payload: CallRingPayload) => void;
  handleAccepted: (payload: CallSignalPayload) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
  endCall: () => Promise<void>;
  handleEnded: (reason?: string) => void;
  setMuted: (muted: boolean) => void;
  reset: () => void;
  abandonCall: () => Promise<void>;
}

const initial = {
  phase: 'idle' as CallPhase,
  callId: null,
  conversationId: null,
  roomName: null,
  livekitUrl: null,
  token: null,
  peer: null,
  muted: false,
  error: null,
};

export const useCallStore = create<CallState>((set, get) => ({
  ...initial,

  async startOutgoing(conversationId) {
    if (get().phase !== 'idle') return;
    set({ phase: 'outgoing', conversationId, error: null });
    try {
      const data = await api.post<{
        callId: string;
        roomName: string;
        livekitUrl: string;
        callee: CallParticipant;
      }>('/api/calls/start', { conversationId });
      set({
        callId: data.callId,
        roomName: data.roomName,
        livekitUrl: data.livekitUrl,
        peer: data.callee,
      });
    } catch (error) {
      set({ ...initial, error: error instanceof Error ? error.message : 'Не удалось позвонить' });
    }
  },

  handleRing(payload) {
    if (get().phase !== 'idle') return;
    set({
      phase: 'ringing',
      callId: payload.callId,
      conversationId: payload.conversationId,
      roomName: payload.roomName,
      peer: payload.caller,
      error: null,
    });
  },

  async handleAccepted(payload) {
    const { callId } = get();
    if (!callId || payload.callId !== callId) return;
    set({
      phase: 'connecting',
      roomName: payload.roomName,
      livekitUrl: payload.livekitUrl,
    });
    try {
      const tokenData = await api.get<{ token: string; roomName: string; livekitUrl: string }>(
        `/api/calls/${callId}/token`,
      );
      set({
        token: tokenData.token,
        roomName: tokenData.roomName,
        livekitUrl: tokenData.livekitUrl,
        phase: 'active',
      });
    } catch (error) {
      void get().abandonCall();
      set({ ...initial, error: error instanceof Error ? error.message : 'Не удалось подключиться' });
    }
  },

  async acceptIncoming() {
    const { callId, phase } = get();
    if (!callId || phase !== 'ringing') return;
    set({ phase: 'connecting', error: null });
    try {
      const accepted = await api.post<CallSignalPayload>(`/api/calls/${callId}/accept`);
      const tokenData = await api.get<{ token: string; roomName: string; livekitUrl: string }>(
        `/api/calls/${callId}/token`,
      );
      set({
        roomName: accepted.roomName,
        livekitUrl: accepted.livekitUrl,
        token: tokenData.token,
        phase: 'active',
      });
    } catch (error) {
      void get().abandonCall();
      set({ ...initial, error: error instanceof Error ? error.message : 'Не удалось принять звонок' });
    }
  },

  async declineIncoming() {
    const { callId } = get();
    if (!callId) {
      set(initial);
      return;
    }
    await api.post(`/api/calls/${callId}/decline`).catch(() => undefined);
    set(initial);
  },

  async endCall() {
    const { callId } = get();
    if (callId) await api.post(`/api/calls/${callId}/end`).catch(() => undefined);
    set(initial);
  },

  handleEnded(_reason?: string) {
    set(initial);
  },

  async abandonCall() {
    const { callId } = get();
    if (callId) {
      await api.post(`/api/calls/${callId}/end`).catch(() => undefined);
    } else {
      await api.post('/api/calls/abandon').catch(() => undefined);
    }
    set(initial);
  },

  setMuted(muted) {
    set({ muted });
  },

  reset() {
    set(initial);
  },
}));

export function isCallActive(): boolean {
  const phase = useCallStore.getState().phase;
  return phase !== 'idle' && phase !== 'ended';
}
