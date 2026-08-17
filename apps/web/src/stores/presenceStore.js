import { create } from 'zustand';
export const usePresenceStore = create((set) => ({
    statuses: {},
    set: (userId, status) => set((state) => ({ statuses: { ...state.statuses, [userId]: status } })),
    reset: () => set({ statuses: {} }),
}));
/** Socket presence wins over the value baked into the cached user row. */
export function usePresence(userId, fallback) {
    return usePresenceStore((state) => state.statuses[userId] ?? fallback);
}
//# sourceMappingURL=presenceStore.js.map