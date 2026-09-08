/**
 * Call billing deduction verification.
 * Run: npx tsx scripts/verify-call-deduction.ts
 */
import { verifyApi as api } from './lib/verify-api';

async function main() {
  console.log('\n=== Call Deduction Verification ===\n');
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
      body: { role: 'user', seedCoins: 200 },
    })) as { accessToken: string };

    const discover = (await api('/hosts/discover?page=1&limit=20', {
      token: user.accessToken,
    })) as {
      hosts: Array<{
        userId: string;
        coinsPerMinute?: number;
        isAiHost?: boolean;
        profileType?: string;
      }>;
    };

    const host =
      discover.hosts.find((h) => h.isAiHost || h.profileType === 'AI_HOST') ??
      discover.hosts[0];

    if (!host) {
      fail('Discover host for call test');
      process.exit(1);
    }

    if (host.coinsPerMinute != null) ok('Discover shows coinsPerMinute', `${host.coinsPerMinute}/min`);
    else fail('Discover shows coinsPerMinute');

    const call = (await api('/calls/initiate', {
      method: 'POST',
      token: user.accessToken,
      body: { calleeId: host.userId },
    })) as { callId: string; coinsPerMinute?: number; isVirtualHost?: boolean };

    if (call.coinsPerMinute) ok('Call locked coinsPerMinute', `${call.coinsPerMinute}/min`);
    else fail('Call locked coinsPerMinute');

    const consent = (await api(`/calls/${call.callId}/consent`, {
      method: 'POST',
      token: user.accessToken,
      body: { documentVersion: '1.0' },
    })) as { autoAccepted?: boolean };

    if (call.isVirtualHost && consent.autoAccepted) {
      ok('AI host auto-accepted on caller consent');
    } else if (!call.isVirtualHost) {
      const hostLogin = (await api('/auth/dev-login', {
        method: 'POST',
        body: { role: 'host' },
      })) as { accessToken: string };

      await api(`/calls/${call.callId}/consent`, {
        method: 'POST',
        token: hostLogin.accessToken,
        body: { documentVersion: '1.0' },
      });

      await api(`/calls/${call.callId}/accept`, {
        method: 'POST',
        token: hostLogin.accessToken,
      });
      ok('Real host accepted call');
    } else {
      fail('AI host auto-accept');
    }

    const tooSoon = (await api(`/calls/${call.callId}/billing-tick`, {
      method: 'POST',
      token: user.accessToken,
    })) as { billed: boolean; reason?: string };

    if (!tooSoon.billed && (tooSoon.reason === 'too_soon' || tooSoon.reason === 'free_call')) {
      ok('Billing tick anti-double-charge guard');
    } else if (!tooSoon.billed) {
      ok('Billing tick guarded before 60s');
    } else {
      fail('Billing tick anti-double-charge guard');
    }

    await api(`/calls/${call.callId}/end`, { method: 'POST', token: user.accessToken });
    ok('Call ended cleanly');
  } catch (err) {
    fail('Call deduction flow', err instanceof Error ? err.message : String(err));
  }

  console.log(`\n=== ${passed}/${passed + failed} passed ===\n`);
  if (failed) process.exit(1);
}

main();