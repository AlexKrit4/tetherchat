/** Empty base means same-origin, which is how nginx serves production. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export class ApiRequestError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'ApiRequestError';
    }
}
let accessToken = null;
let refreshPromise = null;
const listeners = new Set();
export function setAccessToken(token) {
    accessToken = token;
    for (const listener of listeners)
        listener(token);
}
export function getAccessToken() {
    return accessToken;
}
export function onTokenChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent
 * callers share one in-flight request so a burst of 401s triggers a single refresh.
 */
export function refreshSession() {
    refreshPromise ??= (async () => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: '{}',
            });
            if (!response.ok) {
                setAccessToken(null);
                return null;
            }
            const data = (await response.json());
            setAccessToken(data.accessToken);
            return data.accessToken;
        }
        catch {
            return null;
        }
        finally {
            refreshPromise = null;
        }
    })();
    return refreshPromise;
}
async function parseError(response) {
    let body = null;
    try {
        body = (await response.json());
    }
    catch {
        body = null;
    }
    return new ApiRequestError(response.status, body?.code ?? 'unknown_error', body?.message ?? `Request failed with status ${response.status}`, body?.details);
}
function buildUrl(path, query) {
    const url = `${API_BASE}${path}`;
    if (!query)
        return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '')
            params.set(key, String(value));
    }
    const search = params.toString();
    return search ? `${url}?${search}` : url;
}
export async function apiFetch(path, options = {}) {
    const { body, skipRefresh, query, headers, ...rest } = options;
    const send = async (token) => {
        const isFormData = body instanceof FormData;
        return fetch(buildUrl(path, query), {
            ...rest,
            credentials: 'include',
            headers: {
                ...(isFormData || body === undefined ? {} : { 'content-type': 'application/json' }),
                ...(token ? { authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
        });
    };
    let response = await send(accessToken);
    if (response.status === 401 && !skipRefresh) {
        const token = await refreshSession();
        if (token)
            response = await send(token);
    }
    if (!response.ok)
        throw await parseError(response);
    if (response.status === 204)
        return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json'))
        return undefined;
    return (await response.json());
}
export const api = {
    get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
    post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body }),
    put: (path, body, options) => apiFetch(path, { ...options, method: 'PUT', body }),
    delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
};
export function errorMessage(error, fallback = 'Something went wrong') {
    if (error instanceof ApiRequestError)
        return error.message;
    if (error instanceof Error && error.message)
        return error.message;
    return fallback;
}
//# sourceMappingURL=api.js.map