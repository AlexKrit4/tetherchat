import { create } from 'zustand';
import { api, setAccessToken } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
export const useAuthStore = create((set) => ({
    status: 'loading',
    user: null,
    bootstrap: async () => {
        try {
            const session = await api.post('/api/auth/refresh', {}, { skipRefresh: true });
            setAccessToken(session.accessToken);
            set({ status: 'authenticated', user: session.user });
        }
        catch {
            setAccessToken(null);
            set({ status: 'anonymous', user: null });
        }
    },
    login: async (login, password) => {
        const session = await api.post('/api/auth/login', { login, password }, { skipRefresh: true });
        setAccessToken(session.accessToken);
        set({ status: 'authenticated', user: session.user });
    },
    register: async (input) => {
        const session = await api.post('/api/auth/register', input, { skipRefresh: true });
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
}));
//# sourceMappingURL=authStore.js.map