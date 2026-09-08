/**
 * Wallet verification — balance, history, admin adjust.
 * Run: npx tsx scripts/verify-wallet.ts
 */
import { verifyApi as api } from './lib/verify-api';

async function main() {
  console.log('\n=== Wallet Verification ===\n');
  let passed = 0;
  let failed = 0;

  const ok = (name: string, detail?: string) => {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const fail = (name: string, detail?: string) => {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const user = (await api('/auth/dev-login', {
      method: 'POST',
      body: { role: 'user', seedCoins: 50 },
    })) as { accessToken: string; user: { id: string } };

    const wallet = (await api('/wallet', { token: user.accessToken })) as {
      balanceCoins: number;
    };
    if (wallet.balanceCoins >= 50) ok('Wallet balance', `${wallet.balanceCoins} coins`);
    else fail('Wallet balance', String(wallet.balanceCoins));

    const history = await api('/wallet/history', { token: user.accessToken });
    if (history) ok('GET /wallet/history');

    const txs = await api('/wallet/transactions', { token: user.accessToken });
    if (txs) ok('GET /wallet/transactions');

    const admin = (await api('/auth/dev-login', {
      method: 'POST',
      body: { role: 'admin' },
    })) as { accessToken: string };

    const adjusted = (await api(`/admin/wallet/users/${user.user.id}/adjust`, {
      method: 'POST',
      token: admin.accessToken,
      body: { amountCoins: 10, action: 'credit', reason: 'verify-wallet' },
    })) as { balanceCoins: number };

    if (adjusted.balanceCoins >= wallet.balanceCoins) {
      ok('Admin wallet credit');
    } else {
      fail('Admin wallet credit');
    }

    const overview = await api('/admin/wallet/overview', { token: admin.accessToken });
    if (overview) ok('Admin wallet overview');
  } catch (err) {
    fail('Wallet flow', err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== ${passed}/${passed + failed} passed ===\n`);
  if (failed) process.exit(1);
}

main();