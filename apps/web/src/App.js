import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { UpdatePrompt } from '@/components/system/UpdatePrompt';
import { Spinner } from '@/components/ui/Spinner';
import { DM_ROUTE } from '@/hooks/useChatTarget';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { InvitePage } from '@/pages/InvitePage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/ForgotPasswordPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { useAuthStore } from '@/stores/authStore';
export function App() {
    const status = useAuthStore((state) => state.status);
    const bootstrap = useAuthStore((state) => state.bootstrap);
    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);
    if (status === 'loading')
        return _jsx(BootSplash, {});
    return (_jsxs(ErrorBoundary, { children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(AnonymousOnly, { children: _jsx(LoginPage, {}) }) }), _jsx(Route, { path: "/register", element: _jsx(AnonymousOnly, { children: _jsx(RegisterPage, {}) }) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPasswordPage, {}) }), _jsx(Route, { path: "/reset-password", element: _jsx(ResetPasswordPage, {}) }), _jsx(Route, { path: "/verify-email", element: _jsx(VerifyEmailPage, {}) }), _jsx(Route, { path: "/invite/:code", element: _jsx(InvitePage, {}) }), _jsx(Route, { path: "/channels/:serverId/:channelId?", element: _jsx(RequireAuth, { children: _jsx(AppShell, {}) }) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: `/channels/${DM_ROUTE}`, replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: `/channels/${DM_ROUTE}`, replace: true }) })] }), _jsx(Toaster, {}), _jsx(UpdatePrompt, {})] }));
}
function RequireAuth({ children }) {
    const status = useAuthStore((state) => state.status);
    const location = useLocation();
    if (status !== 'authenticated') {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location.pathname } });
    }
    return _jsx(_Fragment, { children: children });
}
function AnonymousOnly({ children }) {
    const status = useAuthStore((state) => state.status);
    if (status === 'authenticated')
        return _jsx(Navigate, { to: `/channels/${DM_ROUTE}`, replace: true });
    return _jsx(_Fragment, { children: children });
}
function BootSplash() {
    return (_jsxs("div", { className: "flex h-screen-dvh flex-col items-center justify-center gap-3 bg-base-tertiary", children: [_jsx(Spinner, { className: "h-8 w-8 text-brand" }), _jsx("p", { className: "text-base text-text-muted", children: "Connecting to TetherChat\u2026" })] }));
}
//# sourceMappingURL=App.js.map