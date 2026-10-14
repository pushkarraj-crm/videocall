import assert from 'node:assert/strict';
import type { UserProfile } from '../src/types/api';

async function main() {
  const storage = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    document: { cookie: '' },
  });
  Object.assign(globalThis, { window: { localStorage: globalThis.localStorage } });
  const { authApi } = await import('../src/lib/api/auth');
  const { useAuthStore } = await import('../src/stores/auth-store');
  let requests = 0;
  const pending: Array<(profile: UserProfile) => void> = [];
  authApi.getMe = () => {
    requests++;
    return new Promise<UserProfile>((resolve) => pending.push(resolve));
  };
  const login = (id: string) => useAuthStore.getState().setSession({
    accessToken: id, user: { id, displayName: id, status: 'active', roles: ['user'] },
  });
  const profile = (id: string): UserProfile => ({ id, displayName: id });

  login('first');
  const first = useAuthStore.getState().refreshProfile();
  const duplicate = useAuthStore.getState().refreshProfile();
  assert.equal(first, duplicate);
  assert.equal(requests, 1, 'Concurrent consumers share a single API request');
  login('second');
  const second = useAuthStore.getState().refreshProfile();
  pending[0](profile('first'));
  await first;
  assert.equal(useAuthStore.getState().profile, null, 'Old account response cannot replace new account');
  assert.equal(useAuthStore.getState().isLoading, true, 'Old response cannot clear new request loading state');
  pending[1](profile('second'));
  await second;
  assert.equal(useAuthStore.getState().profile?.id, 'second');
  assert.equal(useAuthStore.getState().isLoading, false);

  const afterLogout = useAuthStore.getState().refreshProfile();
  useAuthStore.getState().logout();
  pending[2](profile('second'));
  await afterLogout;
  assert.equal(useAuthStore.getState().profile, null, 'Logout remains effective after an in-flight response');

  login('retry');
  authApi.getMe = () => Promise.reject(new Error('offline'));
  await assert.rejects(useAuthStore.getState().refreshProfile(), /offline/);
  assert.equal(useAuthStore.getState().isLoading, false);
  authApi.getMe = async () => profile('retry');
  await useAuthStore.getState().refreshProfile();
  assert.equal(useAuthStore.getState().profile?.id, 'retry', 'Failed requests can be retried');
  console.log('PASS: request deduplication, account switching, logout, and retry');
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
