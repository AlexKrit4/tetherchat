import { create } from 'zustand';
import type { Message } from '@tetherchat/shared';

/** Which single panel the phone layout is showing. */
export type MobileView = 'servers' | 'channels' | 'chat' | 'dms' | 'settings' | 'members' | 'search';

export interface ReplyDraft {
  channelId: string;
  message: Message;
}

interface UiState {
  mobileView: MobileView;
  /** Views the user navigated through, so the back button can unwind them. */
  mobileHistory: MobileView[];
  membersOpen: boolean;
  pinsOpen: boolean;
  searchOpen: boolean;
  collapsedCategories: Record<string, boolean>;
  replyDrafts: Record<string, Message | undefined>;
  editingMessageId: string | null;
  drafts: Record<string, string>;

  setMobileView: (view: MobileView) => void;
  pushMobileView: (view: MobileView) => void;
  popMobileView: () => void;
  toggleMembers: () => void;
  setMembersOpen: (open: boolean) => void;
  setPinsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  toggleCategory: (categoryId: string) => void;
  setReplyDraft: (channelId: string, message: Message | null) => void;
  setEditingMessage: (messageId: string | null) => void;
  setDraft: (channelId: string, value: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
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

  pushMobileView: (view) =>
    set((state) =>
      state.mobileView === view
        ? state
        : { mobileView: view, mobileHistory: [...state.mobileHistory, state.mobileView] },
    ),

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

  toggleCategory: (categoryId) =>
    set((state) => ({
      collapsedCategories: {
        ...state.collapsedCategories,
        [categoryId]: !state.collapsedCategories[categoryId],
      },
    })),

  setReplyDraft: (channelId, message) =>
    set((state) => ({
      replyDrafts: { ...state.replyDrafts, [channelId]: message ?? undefined },
    })),

  setEditingMessage: (messageId) => set({ editingMessageId: messageId }),

  setDraft: (channelId, value) =>
    set((state) => ({ drafts: { ...state.drafts, [channelId]: value } })),
}));
