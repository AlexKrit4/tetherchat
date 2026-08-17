import { create } from 'zustand';
const DURATION_MS = 5_000;
export const useToastStore = create((set, get) => ({
    toasts: [],
    push: (message, kind = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }));
        setTimeout(() => get().dismiss(id), DURATION_MS);
    },
    dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
export const toast = {
    info: (message) => useToastStore.getState().push(message, 'info'),
    success: (message) => useToastStore.getState().push(message, 'success'),
    error: (message) => useToastStore.getState().push(message, 'error'),
};
//# sourceMappingURL=toastStore.js.map