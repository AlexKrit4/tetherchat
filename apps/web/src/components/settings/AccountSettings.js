import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
export function AccountSettings() {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const [username, setUsername] = useState(user?.username ?? '');
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: (nextUsername) => api.patch('/api/users/@me', { username: nextUsername }),
        onSuccess: (updated) => {
            setUser(updated);
            setError(null);
            toast.success('Username updated');
        },
        onError: (mutationError) => {
            const message = errorMessage(mutationError);
            setError(message);
            toast.error(message);
        },
    });
    const requestReset = useMutation({
        mutationFn: () => api.post('/api/auth/forgot-password', { email: user?.email }),
        onSuccess: () => toast.success('Password reset link sent to your email'),
    });
    if (!user)
        return null;
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsxs("div", { className: "rounded-lg bg-base-secondary p-4", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-[0.02em] text-text-muted", children: "Email" }), _jsxs("p", { className: "mt-1 flex flex-wrap items-center gap-2 text-base text-text", children: [user.email, _jsx("span", { className: user.emailVerified
                                    ? 'rounded bg-[rgba(35,165,89,0.15)] px-1.5 py-0.5 text-2xs font-semibold uppercase text-success'
                                    : 'rounded bg-[rgba(242,63,67,0.15)] px-1.5 py-0.5 text-2xs font-semibold uppercase text-danger', children: user.emailVerified ? 'Verified' : 'Unverified' })] })] }), _jsx(Input, { label: "Username", value: username, error: error, maxLength: LIMITS.username.max, hint: "Lowercase letters, digits, dot, dash and underscore.", onChange: (event) => {
                    setUsername(event.target.value.toLowerCase());
                    setError(null);
                } }), _jsx(Button, { loading: save.isPending, disabled: username === user.username, onClick: () => {
                    if (!USERNAME_PATTERN.test(username) || username.length < LIMITS.username.min) {
                        setError('That username is not allowed');
                        return;
                    }
                    save.mutate(username);
                }, children: "Save username" }), _jsx("div", { className: "h-px bg-divider" }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-base font-semibold text-text-heading", children: "Password" }), _jsxs("p", { className: "text-sm text-text-muted", children: ["We send a one-time link to ", user.email, ". Existing sessions sign out after a reset."] }), _jsx(Button, { variant: "secondary", loading: requestReset.isPending, onClick: () => requestReset.mutate(), children: "Send password reset link" })] })] }));
}
//# sourceMappingURL=AccountSettings.js.map