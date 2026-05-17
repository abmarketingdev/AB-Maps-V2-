import { authService } from './authService';

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
type QueueItem = { resolve: (token: string) => void; reject: (err: Error) => void };
let failedQueue: QueueItem[] = [];

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

async function getValidToken(): Promise<string> {
  const token = authService.getAccessToken();
  if (token) return token;
  throw new Error('No access token available. Please login.');
}

async function refreshAndQueue(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  refreshPromise = authService.refreshToken()
    .then(() => {
      const newToken = authService.getAccessToken();
      if (!newToken) throw new Error('No access token after refresh');
      processQueue(null, newToken);
    })
    .catch((err) => {
      processQueue(err, null);
      throw err;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  await refreshPromise;
  const token = authService.getAccessToken();
  if (!token) throw new Error('No access token after refresh');
  return token;
}

/**
 * Centralized authenticated fetch with 401 retry queue.
 * Only ONE refresh call is made even if multiple requests get 401 simultaneously.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    try {
      const newToken = await refreshAndQueue();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });
      return retryResponse;
    } catch {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Authentication failed. Please login again.');
    }
  }

  return response;
}
