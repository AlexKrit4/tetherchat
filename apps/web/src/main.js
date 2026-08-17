import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ApiRequestError } from './lib/api';
import './styles/global.css';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
                // Never retry a request the server refused on purpose.
                if (error instanceof ApiRequestError && error.status < 500)
                    return false;
                return failureCount < 2;
            },
        },
        mutations: { retry: false },
    },
});
const container = document.getElementById('root');
if (!container)
    throw new Error('Root container is missing from index.html');
createRoot(container).render(_jsx(StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsx(App, {}) }) }) }));
//# sourceMappingURL=main.js.map