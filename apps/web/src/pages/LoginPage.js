import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { DM_ROUTE } from '@/hooks/useChatTarget';
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore((state) => state.login);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const redirectTo = location.state?.from ?? `/channels/${DM_ROUTE}`;
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await login(identifier.trim(), password);
            navigate(redirectTo, { replace: true });
        }
        catch (loginError) {
            setError(errorMessage(loginError, 'Could not sign in'));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(AuthLayout, { title: "Welcome back", subtitle: "We are happy to see you again.", footer: _jsxs(_Fragment, { children: ["Need an account?", ' ', _jsx(Link, { to: "/register", className: "text-text-link hover:underline", children: "Register" })] }), children: _jsxs("form", { className: "flex flex-col gap-4", onSubmit: submit, noValidate: true, children: [_jsx(Input, { label: "Email or username", autoComplete: "username", autoCapitalize: "none", autoFocus: true, required: true, value: identifier, onChange: (event) => setIdentifier(event.target.value) }), _jsx(Input, { label: "Password", type: "password", autoComplete: "current-password", required: true, value: password, error: error, onChange: (event) => setPassword(event.target.value) }), _jsx(Link, { to: "/forgot-password", className: "-mt-2 self-start text-sm text-text-link hover:underline", children: "Forgot your password?" }), _jsx(Button, { type: "submit", size: "lg", fullWidth: true, loading: busy, children: "Log In" })] }) }));
}
//# sourceMappingURL=LoginPage.js.map