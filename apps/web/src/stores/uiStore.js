import { create } from 'zustand';
export const useUiStore = create((set, get) => ({
    mobileView: 'chat',
    mobileHistory: [],
    membersOpen: true,
    pinsOpen: false,
    searchOpen: false,
    collapsedCategories: {},
    replyDrafts: {},
    editingMessageId: null,
    drafts: {},
    setMobileView: (view) => set({ mobileView: view, mobileHistory: [] }),
    pushMobileView: (view) => set((state) => state.mobileView === view
        ? state
        : { mobileView: view, mobileHistory: [...state.mobileHistory, state.mobileView] }),
    popMobileView: () => {
        const { mobileHistory } = get();
        if (mobileHistory.length === 0) {
            set({ mobileView: 'channels' });
            return;
        }
        const next = mobileHistory[mobileHistory.length - 1];
        set({ mobileView: next, mobileHistory: mobileHistory.slice(0, -1) });
    },
    toggleMembers: () => set((state) => ({ membersOpen: !state.membersOpen })),
    setMembersOpen: (open) => set({ membersOpen: open }),
    setPinsOpen: (open) => set({ pinsOpen: open }),
    setSearchOpen: (open) => set({ searchOpen: open }),
    toggleCategory: (categoryId) => set((state) => ({
        collapsedCategories: {
            ...state.collapsedCategories,
            [categoryId]: !state.collapsedCategories[categoryId],
        },
    })),
    setReplyDraft: (channelId, message) => set((state) => ({
        replyDrafts: { ...state.replyDrafts, [channelId]: message ?? undefined },
    })),
    setEditingMessage: (messageId) => set({ editingMessageId: messageId }),
    setDraft: (channelId, value) => set((state) => ({ drafts: { ...state.drafts, [channelId]: value } })),
}));
//# sourceMappingURL=uiStore.js.map