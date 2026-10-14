import { callsApi } from '@/lib/api/calls';

export const CALL_TERMINAL_STATUSES = new Set(['ended', 'rejected', 'cancelled', 'missed']);

export async function waitForCallActive(
  callId: string,
  timeoutMs = 5 * 60_000,
  onStatus?: (status: string) => void,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const call = await callsApi.getCall(callId);
      onStatus?.(call.status);
      if (call.status === 'active') return true;
      if (CALL_TERMINAL_STATUSES.has(call.status)) return false;
    } catch {
      /* retry on transient API errors */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}