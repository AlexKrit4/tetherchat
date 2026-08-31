import { create } from 'zustand';

export interface TypingUser {
  id: string;
  username: string;
}

interface TypingState {
  byChannel: Record<string, TypingUser[]>;
  set: (channelId: string, users: TypingUser[]) => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  byChannel: {},
  set: (channelId, users) =>
    set((state) => ({ byChannel: { ...state.byChannel, [channelId]: users } })),
}));

const EMPTY: TypingUser[] = [];

export function useTypingUsers(channelId: string | undefined): TypingUser[] {
  return useTypingStore((state) => (channelId ? state.byChannel[channelId] ?? EMPTY : EMPTY));
}
