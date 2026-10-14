import type { ApiError, ApiResponse } from '@/types/api';
import { devLog } from '@/lib/dev-log';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE',
]);

const FRIENDLY_MESSAGES: Record<string, string> = {
  CALL_NOT_FOUND: 'This call is no longer available.',
  NOT_PARTICIPANT: 'You are not part of this call.',
  HOST_BUSY: 'This host is on another call. Try someone else.',
  HOST_OFFLINE: 'This host is offline right now.',
  NO_HOSTS_AVAILABLE: 'No hosts are available. Please try again shortly.',
  NO_AI_HOSTS: 'AI hosts are unavailable right now.',
  AI_CAPACITY: 'AI hosts are at capacity. Please try again soon.',
  REAL_HOST_TIMEOUT: 'No host accepted your call in time.',
  INSUFFICIENT_BALANCE: 'You do not have enough coins for this action.',
};

export class ApiClientError extends Error {
  code?: string;
  statusCode: number;
  retryable: boolean;
  requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    options?: { code?: string; retryable?: boolean; requestId?: string },
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = options?.code;
    this.retryable = options?.retryable ?? RETRYABLE_STATUS.has(statusCode);
    this.requestId = options?.requestId;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('platform_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('platform_token', token);
  document.cookie = `platform_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function clearAuthToken() {
  localStorage.removeItem('platform_token');
  document.cookie = 'platform_token=; path=/; max-age=0';
}

function friendlyMessage(message: string, code?: string, statusCode?: number): string {
  if (code && FRIENDLY_MESSAGES[code]) return FRIENDLY_MESSAGES[code];
  if (statusCode === 401) return 'Please sign in to continue.';
  if (statusCode === 403) return 'You do not have permission to do that.';
  if (statusCode === 404) return 'The requested item could not be found.';
  if (statusCode && statusCode >= 500) return 'Something went wrong on our end. Please try again.';
  if (/internal server error/i.test(message)) return 'Something went wrong. Please try again.';
  return message || 'Request failed';
}

async function parseJsonSafe(res: Response): Promise<ApiResponse<unknown> | ApiError | null> {
  try {
    return (await res.json()) as ApiResponse<unknown> | ApiError;
  } catch {
    return null;
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestInit & { auth?: boolean; retries?: number } = {},
): Promise<T> {
  const { auth = true, headers, retries = 0, ...rest } = options;

  const reqHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (auth) {
    const token = getToken();
    if (token) {
      (reqHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  let lastError: ApiClientError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: reqHeaders,
      });
    } catch (networkErr) {
      const retryable = attempt < retries;
      lastError = new ApiClientError('Network error. Check your connection.', 0, {
        code: 'NETWORK_ERROR',
        retryable: true,
      });
      devLog('API_NETWORK_ERROR', { path, attempt, error: String(networkErr) });
      if (retryable) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }

    const json = await parseJsonSafe(res);

    if (!res.ok || !json || !json.success) {
      const err = (json as ApiError | null)?.error;
      const code = err?.code;
      const statusCode = err?.statusCode ?? res.status;
      const rawMessage = err?.message ?? res.statusText ?? 'Request failed';
      const retryable =
        RETRYABLE_STATUS.has(statusCode) ||
        (code ? RETRYABLE_CODES.has(code) : false);

      if (statusCode >= 500 || code) {
        devLog('API_ERROR', {
          endpoint: path,
          path,
          statusCode,
          code,
          message: rawMessage,
          requestId: (json as ApiError | null)?.requestId,
          responseBody: json,
        });
      }

      lastError = new ApiClientError(friendlyMessage(rawMessage, code, statusCode), statusCode, {
        code,
        retryable,
        requestId: (json as ApiError | null)?.requestId,
      });

      if (retryable && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }

      throw lastError;
    }

    return (json as ApiResponse<T>).data;
  }

  throw lastError ?? new ApiClientError('Request failed', 0);
}