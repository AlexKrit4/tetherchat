import { create } from 'zustand';
import type { AuthResponse, QrLoginPollResult, QrLoginStart, SelfUser, TotpChallenge } from '@tetherchat/shared';
import { api, refreshWithToken, setAccessToken } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { queryClient } from '@/lib/queryClient';
import {
  clearAccounts,
  loadAccounts,
  rememberCurrent,
  saveAccounts,
  snapUser,
  stashOtherFromCurrent,
} from '@/lib/accounts';
import { isDesktopApp } from '@/lib/desktop';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

function applySession(session: AuthResponse): void {
  setAccessToken(session.accessToken);
  rememberCurrent(session.user, session.refreshToken);
}

interface AuthState {
  status: AuthStatus;
  user: SelfUser | null;
  /** Restores a session from the refresh cookie on first paint. */
  bootstrap: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  completeTotp: (ticket: string, code: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: SelfUser) => void;
  startQrLogin: () => Promise<QrLoginStart>;
  pollQrLogin: (ticket: string) => Promise<QrLoginPollResult>;
  cancelQrLogin: (ticket: string) => Promise<void>;
  switchAccount: () => Promise<void>;
  addAccount: (login: string, password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    try {
      if (isDesktopApp()) {
        const store = loadAccounts();
        if (store.current?.refreshToken) {
          const session = await refreshWithToken(store.current.refreshToken);
          applySession(session);
          set({ status: 'authenticated', user: session.user });
          return;
        }
      }
      const session = await api.post<AuthResponse>('/api/auth/refresh', {}, { skipRefresh: true });
      applySession(session);
      set({ status: 'authenticated', user: session.user });
    } catch {
      setAccessToken(null);
      set({ status: 'anonymous', user: null });
    }
  },

  login: async (login, password) => {
    const session = await api.post<AuthResponse | TotpChallenge>(
      '/api/auth/login',
      { login, password },
      { skipRefresh: true },
    );
    if ('requires2fa' in session && session.requires2fa) {
      throw Object.assign(new Error('totp_required'), { ticket: session.ticket, code: 'totp_required' });
    }
    const authed = session as AuthResponse;
    applySession(authed);
    set({ status: 'authenticated', user: authed.user });
  },

  completeTotp: async (ticket, code) => {
    const session = await api.post<AuthResponse>(
      '/api/auth/login/totp',
      { ticket, code },
      { skipRefresh: true },
    );
    applySession(session);
    set({ status: 'authenticated', user: session.user });
  },

  register: async (input) => {
    const session = await api.post<AuthResponse>('/api/auth/register', input, { skipRefresh: true });
    applySession(session);
    set({ status: 'authenticated', user: session.user });
  },

  logout: async () => {
    const other = loadAccounts().other;
    await api.post('/api/auth/logout').catch(() => undefined);
    disconnectSocket();
    queryClient.clear();
    if (other?.refreshToken) {
      try {
        const session = await refreshWithToken(other.refreshToken);
        applySession(session);
        saveAccounts({ current: snapUser(session.user, session.refreshToken ?? other.refreshToken), other: null });
        set({ status: 'authenticated', user: session.user });
        return;
      } catch {
        clearAccounts();
      }
    } else {
      clearAccounts();
    }
    setAccessToken(null);
    set({ status: 'anonymous', user: null });
  },

  setUser: (user) => set({ user }),

  startQrLogin: async () => {
    return api.post<QrLoginStart>('/api/auth/qr/start', {}, { skipRefresh: true });
  },

  pollQrLogin: async (ticket) => {
    const result = await api.get<QrLoginPollResult>(
      `/api/auth/qr/poll?ticket=${encodeURIComponent(ticket)}`,
      { skipRefresh: true },
    );
    if (result.status === 'approved') {
      applySession(result);
      set({ status: 'authenticated', user: result.user });
    }
    return result;
  },

  cancelQrLogin: async (ticket) => {
    await api.post('/api/auth/qr/cancel', { ticket }, { skipRefresh: true }).catch(() => undefined);
  },

  switchAccount: async () => {
    const store = loadAccounts();
    if (!store.other?.refreshToken) return;
    const previous = get().user && store.current ? store.current : null;
    disconnectSocket();
    queryClient.clear();
    const session = await refreshWithToken(store.other.refreshToken);
    applySession(session);
    saveAccounts({
      current: snapUser(session.user, session.refreshToken ?? store.other.refreshToken),
      other: previous,
    });
    set({ status: 'authenticated', user: session.user });
  },

  addAccount: async (login, password) => {
    const me = get().user;
    if (!me?.isPlus) throw new Error('plus_required');
    if (loadAccounts().other) throw new Error('accounts_full');
    stashOtherFromCurrent();
    try {
      await get().login(login, password);
    } catch (error) {
      const store = loadAccounts();
      saveAccounts({ current: store.other ?? store.current, other: null });
      throw error;
    }
  },
}));
