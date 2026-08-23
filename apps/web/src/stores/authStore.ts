import { create } from 'zustand';
import type { AuthResponse, QrLoginPollResult, QrLoginStart, SelfUser, TotpChallenge } from '@tetherchat/shared';
import { api, setAccessToken } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

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
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  bootstrap: async () => {
    try {
      const session = await api.post<AuthResponse>('/api/auth/refresh', {}, { skipRefresh: true });
      setAccessToken(session.accessToken);
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
    setAccessToken(authed.accessToken);
    set({ status: 'authenticated', user: authed.user });
  },

  completeTotp: async (ticket, code) => {
    const session = await api.post<AuthResponse>(
      '/api/auth/login/totp',
      { ticket, code },
      { skipRefresh: true },
    );
    setAccessToken(session.accessToken);
    set({ status: 'authenticated', user: session.user });
  },

  register: async (input) => {
    const session = await api.post<AuthResponse>('/api/auth/register', input, { skipRefresh: true });
    setAccessToken(session.accessToken);
    set({ status: 'authenticated', user: session.user });
  },

  logout: async () => {
    await api.post('/api/auth/logout').catch(() => undefined);
    setAccessToken(null);
    disconnectSocket();
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
      setAccessToken(result.accessToken);
      set({ status: 'authenticated', user: result.user });
    }
    return result;
  },

  cancelQrLogin: async (ticket) => {
    await api.post('/api/auth/qr/cancel', { ticket }, { skipRefresh: true }).catch(() => undefined);
  },
}));
