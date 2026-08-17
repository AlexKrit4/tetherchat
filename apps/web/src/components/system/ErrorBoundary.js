import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { Button } from '@/components/ui/Button';
/** Keeps a render crash from blanking the whole app. */
export class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('[tetherchat] render error', error, info.componentStack);
    }
    render() {
        const { error } = this.state;
        if (!error)
            return this.props.children;
        return (_jsxs("div", { className: "flex h-screen-dvh flex-col items-center justify-center gap-4 bg-base-tertiary px-6 text-center", children: [_jsx("h1", { className: "text-2xl font-bold text-text-heading", children: "Something broke" }), _jsx("p", { className: "max-w-[420px] text-base text-text-muted", children: "TetherChat hit an unexpected error. Reloading usually clears it." }), _jsx("pre", { className: "max-w-full overflow-x-auto rounded bg-base-secondary p-3 text-left text-sm text-text-muted", children: error.message }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: () => window.location.reload(), children: "Reload" }), _jsx(Button, { variant: "secondary", onClick: () => this.setState({ error: null }), children: "Try again" })] })] }));
    }
}
//# sourceMappingURL=ErrorBoundary.js.map