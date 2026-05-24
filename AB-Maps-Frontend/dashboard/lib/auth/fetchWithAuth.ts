// Authed fetch for live backend calls. Injects the Bearer access token, and on
// a 401 refreshes once and retries. If the refresh itself fails (token
// blacklisted/expired), it forces a re-login. All requests hit the real backend.

import { authService } from './authService';
import { API_CONFIG } from '@/lib/config/apiConfig';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

function forceReLogin(): void {
  authService.logout().catch(() => { /* ignore */ });
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/** Build a full URL from a relative `/api/...` path, or pass through absolutes. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_CONFIG.BASE_URL ?? ''}${path}`;
}

async function authedRequest(url: string, options: RequestInit, isRetry: boolean): Promise<Response> {
  const token = authService.getAccessToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(apiUrl(url), { ...options, headers });

  if (res.status === 401 && !isRetry) {
    try {
      await authService.refreshToken();
    } catch {
      forceReLogin();
      throw new SessionExpiredError();
    }
    return authedRequest(url, options, true);
  }

  return res;
}

/** Authed fetch with one transparent refresh-and-retry on 401. */
export function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return authedRequest(url, options, false);
}

/** Authed GET returning parsed JSON; throws on non-2xx. */
export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${path}`);
  }
  return res.json() as Promise<T>;
}
