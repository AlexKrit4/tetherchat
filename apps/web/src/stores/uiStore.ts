import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '@tetherchat/shared';

/** Which single panel the phone layout is showing. */
export type MobileView = 'servers' | 'channels' | 'chat' | 'dms' | 'settings' | 'members' | 'search' | 'friends';

export interface ReplyDraft {
  channelId: string;
  message: Message;
}

interface UiState {
  mobileView: MobileView;
  /** Views the user navigated through, so the back button can unwind them. */
  mobileHistory: MobileView[];
  /** Desktop keeps the member column visible by default, like Discord. */
  membersOpen: boolean;
  /** Tablet shows members as a slide-over, so it starts closed. */
  membersOverlayOpen: boolean;
  pinsOpen: boolean;
  searchOpen: boolean;
  mediaOpen: boolean;
  collapsedCategories: Record<string, boolean>;
  replyDrafts: Record<string, Message | undefined>;
  editingMessageId: string | null;
  drafts: Record<string, string>;
  scrollBottomNonce: number;

  setMobileView: (view: MobileView) => void;
  pushMobileView: (view: MobileView) => void;
  popMobileView: () => void;
  toggleMembers: () => void;
  setMembersOpen: (open: boolean) => void;
  toggleMembersOverlay: () => void;
  setMembersOverlayOpen: (open: boolean) => void;
  setPinsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setMediaOpen: (open: boolean) => void;
  toggleCategory: (categoryId: string) => void;
  setReplyDraft: (channelId: string, message: Message | null) => void;
  setEditingMessage: (messageId: string | null) => void;
  setDraft: (channelId: string, value: string) => void;
  nudgeScrollBottom: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
  mobileView: 'chat',
  mobileHistory: [],
  membersOpen: true,
  membersOverlayOpen: false,
  pinsOpen: false,
  searchOpen: false,
  mediaOpen: false,
  collapsedCategories: {},
  replyDrafts: {},
  editingMessageId: null,
  drafts: {},
  scrollBottomNonce: 0,

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
  toggleMembersOverlay: () => set((state) => ({ membersOverlayOpen: !state.membersOverlayOpen })),
  setMembersOverlayOpen: (open) => set({ membersOverlayOpen: open }),
  setPinsOpen: (open) => set({ pinsOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setMediaOpen: (open) => set({ mediaOpen: open }),

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

  nudgeScrollBottom: () => set((state) => ({ scrollBottomNonce: state.scrollBottomNonce + 1 })),
    }),
    {
      name: 'tetherchat-ui',
      partialize: (state) => ({
        drafts: state.drafts,
        collapsedCategories: state.collapsedCategories,
      }),
    },
  ),
);
