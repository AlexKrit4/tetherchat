import { create } from 'zustand';
export const useTypingStore = create((set) => ({
    byChannel: {},
    set: (channelId, users) => set((state) => ({ byChannel: { ...state.byChannel, [channelId]: users } })),
}));
const EMPTY = [];
export function useTypingUsers(channelId) {
    return useTypingStore((state) => (channelId ? state.byChannel[channelId] ?? EMPTY : EMPTY));
}
//# sourceMappingURL=typingStore.js.map