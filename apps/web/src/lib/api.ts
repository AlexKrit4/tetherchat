import type { ApiErrorBody, AuthResponse } from '@tetherchat/shared';
import { t } from '@/i18n';

/** Empty base means same-origin, which is how nginx serves production. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type TokenListener = (token: string | null) => void;

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const listeners = new Set<TokenListener>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onTokenChange(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent
 * callers share one in-flight request so a burst of 401s triggers a single refresh.
 */
export function refreshSession(): Promise<string | null> {
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
      const data = (await response.json()) as AuthResponse;
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function refreshWithToken(refreshToken: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/refresh', {
    method: 'POST',
    body: {},
    skipRefresh: true,
    headers: { 'x-refresh-token': refreshToken },
  });
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set for the auth endpoints, which must not recurse into a refresh. */
  skipRefresh?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

async function parseError(response: Response): Promise<ApiRequestError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  return new ApiRequestError(
    response.status,
    body?.code ?? 'unknown_error',
    body?.message ?? `Request failed with status ${response.status}`,
    body?.details,
  );
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh, query, headers, ...rest } = options;

  const send = async (token: string | null): Promise<Response> => {
    const isFormData = body instanceof FormData;
    return fetch(buildUrl(path, query), {
      ...rest,
      credentials: 'include',
      headers: {
        ...(isFormData || body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await send(accessToken);

  if (response.status === 401 && !skipRefresh) {
    const token = await refreshSession();
    if (token) response = await send(token);
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined as T;

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export function errorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback ?? t('common.error');
}
