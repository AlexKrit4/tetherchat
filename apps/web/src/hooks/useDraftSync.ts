import { useEffect } from 'react';
import type { ComposerDraft } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

function draftsPayload(): Record<string, ComposerDraft> {
  const { drafts, draftTimes } = useUiStore.getState();
  const payload: Record<string, ComposerDraft> = {};
  for (const [id, text] of Object.entries(drafts)) {
    payload[id] = { text, updatedAt: draftTimes[id] ?? Date.now() };
  }
  return payload;
}

/**
 * Cross-tab via localStorage, cross-device via GET/PATCH /api/users/@me/drafts.
 * Secret-chat drafts stay volatile and never leave the tab.
 *
 * Local drafts are bound to the signed-in user. Otherwise logout / account
 * switch would show (and then upload) the previous person's unsent text.
 */
export function useDraftSync(): void {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'tetherchat-ui') void useUiStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      if (status !== 'authenticated') useUiStore.getState().clearDrafts();
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;
    let timer = 0;

    useUiStore.getState().adoptDraftOwner(userId);

    void api
      .get<{ drafts: Record<string, ComposerDraft> }>('/api/users/@me/drafts')
      .then((data) => {
        if (cancelled) return;
        if (useUiStore.getState().draftOwnerId !== userId) return;
        useUiStore.getState().mergeRemoteDrafts(data.drafts);
        unsub = useUiStore.subscribe((state, prev) => {
          if (state.draftOwnerId !== userId) return;
          if (state.drafts === prev.drafts && state.draftTimes === prev.draftTimes) return;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            if (useUiStore.getState().draftOwnerId !== userId) return;
            void api.patch('/api/users/@me/drafts', { drafts: draftsPayload() }).catch(() => undefined);
          }, 800);
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unsub?.();
      window.clearTimeout(timer);
    };
  }, [status, userId]);
}
