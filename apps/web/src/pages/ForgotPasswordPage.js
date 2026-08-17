import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LIMITS } from '@tetherchat/shared';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/stores/toastStore';
export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            await api.post('/api/auth/forgot-password', { email: email.trim() });
            setSent(true);
        }
        catch (error) {
            toast.error(errorMessage(error));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(AuthLayout, { title: "Reset your password", subtitle: sent
            ? 'If that address is registered, a reset link is on its way.'
            : 'We will email you a one-time link.', footer: _jsx(Link, { to: "/login", className: "text-text-link hover:underline", children: "Back to login" }), children: sent ? null : (_jsxs("form", { className: "flex flex-col gap-4", onSubmit: submit, noValidate: true, children: [_jsx(Input, { label: "Email", type: "email", autoComplete: "email", required: true, autoFocus: true, value: email, onChange: (event) => setEmail(event.target.value) }), _jsx(Button, { type: "submit", size: "lg", fullWidth: true, loading: busy, children: "Send reset link" })] })) }));
}
export function ResetPasswordPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        if (password.length < LIMITS.password.min) {
            setError(`At least ${LIMITS.password.min} characters`);
            return;
        }
        setBusy(true);
        try {
            await api.post('/api/auth/reset-password', { token, password });
            toast.success('Password updated — sign in with your new password');
            navigate('/login', { replace: true });
        }
        catch (resetError) {
            setError(errorMessage(resetError));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(AuthLayout, { title: "Choose a new password", children: _jsxs("form", { className: "flex flex-col gap-4", onSubmit: submit, noValidate: true, children: [_jsx(Input, { label: "New password", type: "password", autoComplete: "new-password", required: true, autoFocus: true, value: password, error: error, onChange: (event) => setPassword(event.target.value) }), _jsx(Button, { type: "submit", size: "lg", fullWidth: true, loading: busy, disabled: token.length === 0, children: "Update password" }), token.length === 0 ? (_jsx("p", { className: "text-sm text-danger", children: "This link is missing its token." })) : null] }) }));
}
//# sourceMappingURL=ForgotPasswordPage.js.map