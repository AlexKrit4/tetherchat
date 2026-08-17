import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useJoinServer } from '@/hooks/useServers';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { serverInitials } from '@/components/layout/ServerRail';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
/** Landing page for tetherchat.ru/invite/<code>, reachable while signed out. */
export function InvitePage() {
    const { code = '' } = useParams();
    const navigate = useNavigate();
    const status = useAuthStore((state) => state.status);
    const join = useJoinServer();
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.invitePreview(code),
        queryFn: () => api.get(`/api/invite/${code}`),
        enabled: code.length > 0,
        retry: false,
    });
    if (isLoading) {
        return (_jsx(AuthLayout, { title: "Checking invite\u2026", children: _jsx("div", { className: "flex justify-center py-6", children: _jsx(Spinner, {}) }) }));
    }
    if (error || !data) {
        return (_jsx(AuthLayout, { title: "Invalid invite", subtitle: "This invite has expired or never existed.", children: _jsx(Button, { fullWidth: true, size: "lg", onClick: () => navigate('/'), children: "Go to TetherChat" }) }));
    }
    const inviterName = data.inviter.displayName ?? data.inviter.username;
    return (_jsx(AuthLayout, { title: data.server.name, subtitle: `${inviterName} invited you to join · ${data.server.memberCount} members`, footer: status === 'anonymous' ? (_jsxs(_Fragment, { children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "text-text-link hover:underline", children: "Log in" })] })) : null, children: _jsxs("div", { className: "flex flex-col items-center gap-4", children: [_jsx("span", { className: "flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-base-tertiary text-xl font-semibold text-text", children: data.server.iconUrl ? (_jsx("img", { src: data.server.iconUrl, alt: "", className: "h-full w-full object-cover" })) : (serverInitials(data.server.name)) }), data.server.description ? (_jsx("p", { className: "text-center text-base text-text-muted", children: data.server.description })) : null, status === 'authenticated' ? (_jsx(Button, { fullWidth: true, size: "lg", loading: join.isPending, onClick: () => data.alreadyMember
                        ? navigate(`/channels/${data.server.id}`)
                        : join.mutate(code, {
                            onSuccess: ({ serverId }) => navigate(`/channels/${serverId}`),
                            onError: (joinError) => toast.error(errorMessage(joinError)),
                        }), children: data.alreadyMember ? 'Open server' : 'Accept invite' })) : (_jsx(Button, { fullWidth: true, size: "lg", onClick: () => navigate('/register', { state: { from: `/invite/${code}` } }), children: "Sign up to join" }))] }) }));
}
//# sourceMappingURL=InvitePage.js.map