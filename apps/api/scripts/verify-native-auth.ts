/** Local-only end-to-end checks. Never sends real email/SMS or prints secrets. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = process.env.AUTH_TEST_API_URL ?? 'http://localhost:3001/v1';
const email = `auth-check-${Date.now()}@example.invalid`;
const phone = `+1999${String(Date.now()).slice(-10)}`;
const password = 'Local-only auth check passphrase';
const replacement = 'Another local-only test passphrase';
const users = new Set<string>();
const mailFiles = new Set<string>();
let challengeId: string | undefined;

async function call(path: string, body?: unknown, token?: string) {
  const res = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data: data.data, error: data.error };
}

async function recoveryToken(purpose: string) {
  for (const name of await readdir('.local/auth-mail')) {
    const path = join('.local/auth-mail', name);
    const message = JSON.parse(await readFile(path, 'utf8')) as { to: string; text: string };
    if (message.to !== email) continue;
    mailFiles.add(path);
    if (message.text.includes(`/login/${purpose}#token=`)) return message.text.match(/#token=([a-f0-9]{64})/)![1];
  }
  throw new Error('Expected recovery message was not created');
}

async function main() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Run only against the local development API');
  assert.ok(!process.env.SMTP_HOST, 'Disable real SMTP for this local test');
  assert.equal(process.env.SMS_PROVIDER ?? 'console', 'console', 'Do not send real SMS during this test');
  const registered = await call('/auth/register', { email: email.toUpperCase(), password, displayName: 'Auth Check' });
  assert.equal(registered.status, 201); users.add(registered.data.user.id);
  assert.deepEqual(registered.data.user.roles, ['user']);
  const stored = await prisma.authCredential.findUniqueOrThrow({ where: { email } });
  assert.ok(stored.passwordHash.startsWith('scrypt$'));
  assert.notEqual(stored.passwordHash, password);
  assert.equal((await call('/auth/register', { email, password, displayName: 'Duplicate' })).status, 409);
  assert.equal((await call('/auth/register', { email: 'short@example.invalid', password: 'short', displayName: 'Short' })).status, 400);
  assert.equal((await call('/auth/login', { email, password: 'wrong' })).status, 401);
  assert.equal((await call('/auth/login', { email, password, intent: 'admin' })).status, 403);
  const login = await call('/auth/login', { email, password }); assert.equal(login.status, 201);
  const profile = await call('/auth/me', undefined, login.data.accessToken); assert.equal(profile.status, 200);
  assert.ok(!('passwordHash' in profile.data) && !('credential' in profile.data));
  const verification = await recoveryToken('verify-email');
  assert.equal((await call('/auth/verify-email', { token: verification })).status, 201);
  assert.equal((await call('/auth/verify-email', { token: verification })).status, 400);
  assert.equal((await call('/auth/forgot-password', { email })).status, 201);
  const reset = await recoveryToken('reset-password');
  assert.equal((await call('/auth/reset-password', { token: reset, password: replacement })).status, 201);
  assert.equal((await call('/auth/reset-password', { token: reset, password: replacement })).status, 400);
  assert.equal((await call('/auth/me', undefined, login.data.accessToken)).status, 401);
  assert.equal((await call('/auth/refresh', { refreshToken: login.data.refreshToken })).status, 401);
  assert.equal((await call('/auth/login', { email, password })).status, 401);
  const next = await call('/auth/login', { email, password: replacement }); assert.equal(next.status, 201);
  assert.equal((await call('/auth/me', undefined, next.data.accessToken)).status, 200);
  const rotations = await Promise.all([call('/auth/refresh', { refreshToken: next.data.refreshToken }), call('/auth/refresh', { refreshToken: next.data.refreshToken })]);
  assert.deepEqual(rotations.map((r) => r.status).sort(), [201, 401]);
  const unknown = await call('/auth/forgot-password', { email: 'absent-auth-check@example.invalid' });
  assert.equal(unknown.status, 201);
  assert.equal(unknown.data.message, 'If an account exists for that email, a reset link will be sent.');

  const requested = await call('/auth/phone/request', { phone }); assert.equal(requested.status, 201);
  challengeId = requested.data.challengeId;
  assert.ok(!('code' in requested.data));
  assert.equal((await call('/auth/phone/request', { phone })).status, 429);
  const smsPath = join('.local/auth-sms', `${challengeId}.json`);
  const sms = JSON.parse(await readFile(smsPath, 'utf8')) as { body: string };
  const code = sms.body.match(/\b(\d{6})\b/)![1];
  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await call('/auth/phone/verify', { challengeId, code: wrong })).status, 401);
  const challenge = await prisma.authOtpChallenge.findUniqueOrThrow({ where: { id: challengeId } });
  assert.equal(challenge.attempts, 1); assert.notEqual(challenge.codeHash, code);
  await prisma.authOtpChallenge.update({ where: { id: challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call('/auth/phone/verify', { challengeId, code })).status, 401);
  await prisma.authOtpChallenge.update({ where: { id: challengeId }, data: { expiresAt: new Date(Date.now() + 60_000), attempts: 5 } });
  assert.equal((await call('/auth/phone/verify', { challengeId, code })).status, 401);
  await prisma.authOtpChallenge.update({ where: { id: challengeId }, data: { attempts: 1 } });
  const verified = await call('/auth/phone/verify', { challengeId, code }); assert.equal(verified.status, 201);
  users.add(verified.data.user.id);
  assert.equal((await call('/auth/phone/verify', { challengeId, code })).status, 401);
  const forged = await call('/auth/google/exchange', { token: '0'.repeat(64) }); assert.equal(forged.status, 400);
  for (const role of ['user', 'host', 'admin']) {
    const dev = await call('/auth/dev-login', { role }); assert.equal(dev.status, 201);
    assert.ok(dev.data.user.roles.includes(role));
    await call('/auth/logout', { refreshToken: dev.data.refreshToken });
  }
  console.log('PASS: native registration/login, normalization, role access, verification, password recovery, session revocation/rotation, OTP cooldown/hash/attempts/expiry/replay, and existing development roles');
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Auth verification failed'); process.exitCode = 1; }).finally(async () => {
  // Only the unique fixtures created by this run are removed.
  for (const id of users) {
    await prisma.$transaction(async (tx) => {
      await tx.walletTransaction.deleteMany({ where: { userId: id } });
      await tx.wallet.deleteMany({ where: { userId: id } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
  }
  if (challengeId) { await prisma.authOtpChallenge.deleteMany({ where: { id: challengeId } }); await unlink(join('.local/auth-sms', `${challengeId}.json`)).catch(() => undefined); }
  for (const path of mailFiles) await unlink(path).catch(() => undefined);
  await prisma.$disconnect();
});
