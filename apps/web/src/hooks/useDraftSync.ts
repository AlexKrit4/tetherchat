import { useEffect } from 'react';
import type { ComposerDraft } from '@tetherchat/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * Cross-tab via localStorage, cross-device via GET/PATCH /api/users/@me/drafts.
 * Secret-chat drafts stay volatile and never leave the tab.
 */
export function useDraftSync(): void {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'tetherchat-ui') void useUiStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    void api
      .get<{ drafts: Record<string, ComposerDraft> }>('/api/users/@me/drafts')
      .then((data) => {
        if (cancelled) return;
        useUiStore.getState().mergeRemoteDrafts(data.drafts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let timer = 0;
    const unsub = useUiStore.subscribe((state, prev) => {
      if (state.drafts === prev.drafts && state.draftTimes === prev.draftTimes) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const { drafts, draftTimes } = useUiStore.getState();
        const payload: Record<string, ComposerDraft> = {};
        for (const [id, text] of Object.entries(drafts)) {
          payload[id] = { text, updatedAt: draftTimes[id] ?? Date.now() };
        }
        void api.patch('/api/users/@me/drafts', { drafts: payload }).catch(() => undefined);
      }, 800);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [status]);
}
