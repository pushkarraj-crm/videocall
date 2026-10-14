import { ApiClientError } from './client';
import { devLog } from '@/lib/dev-log';

export function logBackgroundApiFailure(endpoint: string, err: unknown, responseBody?: unknown) {
  const details =
    err instanceof ApiClientError
      ? {
          endpoint,
          statusCode: err.statusCode,
          code: err.code,
          requestId: err.requestId,
          message: err.message,
          responseBody,
        }
      : { endpoint, error: String(err), responseBody };

  console.warn('BACKGROUND_API_FAILURE', details);
  devLog('BACKGROUND_API_FAILURE', details);
}

export async function retryBackground<T>(
  endpoint: string,
  fn: () => Promise<T>,
  retries = 2,
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      logBackgroundApiFailure(endpoint, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  return null;
}