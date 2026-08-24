import type { SelfUser } from '@tetherchat/shared';

const KEY = 'tetherchat.accounts';

export interface AccountSnap {
  refreshToken: string;
  user: Pick<SelfUser, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isPlus'>;
}

interface AccountStore {
  current: AccountSnap | null;
  other: AccountSnap | null;
}

function empty(): AccountStore {
  return { current: null, other: null };
}

export function loadAccounts(): AccountStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as AccountStore;
    return {
      current: parsed.current ?? null,
      other: parsed.other ?? null,
    };
  } catch {
    return empty();
  }
}

export function saveAccounts(store: AccountStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function snapUser(user: SelfUser, refreshToken: string): AccountSnap {
  return {
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isPlus: user.isPlus,
    },
  };
}

export function rememberCurrent(user: SelfUser, refreshToken: string | undefined): void {
  if (!refreshToken) return;
  const store = loadAccounts();
  store.current = snapUser(user, refreshToken);
  if (store.other?.user.id === user.id) store.other = null;
  saveAccounts(store);
}

export function stashOtherFromCurrent(): void {
  const store = loadAccounts();
  if (store.current) store.other = store.current;
  saveAccounts(store);
}

export function clearAccounts(): void {
  localStorage.removeItem(KEY);
}
