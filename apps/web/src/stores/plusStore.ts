import { create } from 'zustand';

export type PlusReason =
  | 'generic'
  | 'files'
  | 'pins'
  | 'bio'
  | 'transcript'
  | 'colors'
  | 'lastSeen'
  | 'wallpaper'
  | 'accounts'
  | 'secret';

interface PlusState {
  reason: PlusReason | null;
  show: (reason?: PlusReason) => void;
  hide: () => void;
}

export const usePlusStore = create<PlusState>((set) => ({
  reason: null,
  show: (reason = 'generic') => set({ reason }),
  hide: () => set({ reason: null }),
}));
