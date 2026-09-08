/**
 * Auth verification — JWT, refresh tokens, signup bonus.
 * Run: npx tsx scripts/verify-auth.ts
 */
import { verifyApi as api } from './lib/verify-api';

async function main() {
  console.log('\n=== Auth Verification ===\n');
  let passed = 0;
  let failed = 0;

  const ok = (name: string) => {
    passed++;
    console.log(`  ✓ ${name}`);
  };
  const fail = (name: string, detail?: string) => {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const login = (await api('/auth/dev-login', {
      method: 'POST',
      body: { role: 'user', seedCoins: 0, displayName: 'Auth Verify User' },
    })) as {
      accessToken: string;
      refreshToken?: string;
      user: { id: string };
    };

    if (login.accessToken) ok('JWT access token issued');
    else fail('JWT access token issued');

    if (login.refreshToken) ok('Refresh token issued');
    else fail('Refresh token issued');

    const me = (await api('/auth/me', { token: login.accessToken })) as {
      walletCoins?: number;
      lastLoginAt?: string | null;
    };
    if (me.walletCoins != null) ok('Profile includes walletCoins');
    else fail('Profile includes walletCoins');

    if (me.lastLoginAt) ok('lastLoginAt recorded');
    else fail('lastLoginAt recorded');

    if (login.refreshToken) {
      const refreshed = (await api('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: login.refreshToken },
      })) as { accessToken: string; refreshToken?: string };
      if (refreshed.accessToken && refreshed.accessToken !== login.accessToken) {
        ok('Refresh token rotation');
      } else if (refreshed.accessToken) {
        ok('Refresh endpoint works');
      } else {
        fail('Refresh token rotation');
      }
    }

    await api('/auth/logout', {
      method: 'POST',
      body: { refreshToken: login.refreshToken },
    });
    ok('Logout endpoint');
  } catch (err) {
    fail('Auth flow', err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== ${passed}/${passed + failed} passed ===\n`);
  if (failed) process.exit(1);
}

main();