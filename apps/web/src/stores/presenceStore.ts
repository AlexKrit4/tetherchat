import { create } from 'zustand';
import type { PresenceStatus } from '@tetherchat/shared';

interface PresenceState {
  /** Live overrides received over the socket, keyed by user id. */
  statuses: Record<string, PresenceStatus>;
  set: (userId: string, status: PresenceStatus) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  statuses: {},
  set: (userId, status) =>
    set((state) => ({ statuses: { ...state.statuses, [userId]: status } })),
  reset: () => set({ statuses: {} }),
}));

/** Socket presence wins over the value baked into the cached user row. */
export function usePresence(userId: string, fallback: PresenceStatus): PresenceStatus {
  return usePresenceStore((state) => state.statuses[userId] ?? fallback);
}
