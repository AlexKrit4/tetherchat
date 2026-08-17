import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Spinner } from '@/components/ui/Spinner';
export function VerifyEmailPage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [state, setState] = useState('working');
    const [message, setMessage] = useState('');
    useEffect(() => {
        if (!token) {
            setState('failed');
            setMessage('This link is missing its token.');
            return;
        }
        void api
            .post('/api/auth/verify-email', { token })
            .then(() => setState('done'))
            .catch((error) => {
            setState('failed');
            setMessage(errorMessage(error));
        });
    }, [token]);
    return (_jsx(AuthLayout, { title: state === 'working' ? 'Verifying…' : state === 'done' ? 'Email confirmed' : 'Verification failed', subtitle: state === 'failed' ? message : undefined, footer: _jsx(Link, { to: "/login", className: "text-text-link hover:underline", children: "Continue to TetherChat" }), children: state === 'working' ? (_jsx("div", { className: "flex justify-center py-4", children: _jsx(Spinner, {}) })) : null }));
}
//# sourceMappingURL=VerifyEmailPage.js.map