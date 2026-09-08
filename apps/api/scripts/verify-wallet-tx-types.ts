import { PaymentStatus, PrismaClient, WalletTransactionType } from '@prisma/client';
import {
  assertWalletConsistent,
  BALANCE_AFFECTING_TX_TYPES,
} from '../src/modules/wallet/wallet-consistency';

const prisma = new PrismaClient();

async function creditWallet(params: {
  userId: string;
  amountUnits: bigint;
  type: WalletTransactionType;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  description?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) return existing;

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: params.userId } });
    const newBalance = wallet.balanceUnits + params.amountUnits;
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceUnits: newBalance,
        lifetimeCreditedUnits: wallet.lifetimeCreditedUnits + params.amountUnits,
      },
    });
    const row = await tx.walletTransaction.create({
      data: {
        walletId: updated.id,
        userId: params.userId,
        type: params.type,
        amountUnits: params.amountUnits,
        balanceAfterUnits: newBalance,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        description: params.description,
      },
    });
    await assertWalletConsistent(tx, updated.id);
    return row;
  });
}

async function debitWallet(params: {
  userId: string;
  amountUnits: bigint;
  type: WalletTransactionType;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  description?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) return existing;

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: params.userId } });
    const newBalance = wallet.balanceUnits - params.amountUnits;
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceUnits: newBalance,
        lifetimeDebitedUnits: wallet.lifetimeDebitedUnits + params.amountUnits,
      },
    });
    const row = await tx.walletTransaction.create({
      data: {
        walletId: updated.id,
        userId: params.userId,
        type: params.type,
        amountUnits: -params.amountUnits,
        balanceAfterUnits: newBalance,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        description: params.description,
      },
    });
    await assertWalletConsistent(tx, updated.id);
    return row;
  });
}

async function recordLedgerEntry(params: {
  userId: string;
  amountUnits: bigint;
  type: WalletTransactionType;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey: string;
  description?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) return existing;

    const wallet = await tx.wallet.upsert({
      where: { userId: params.userId },
      update: {},
      create: { userId: params.userId },
    });
    const row = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: params.userId,
        type: params.type,
        amountUnits: params.amountUnits,
        balanceAfterUnits: wallet.balanceUnits,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        idempotencyKey: params.idempotencyKey,
        description: params.description,
      },
    });
    await assertWalletConsistent(tx, wallet.id);
    return row;
  });
}

async function reconcileWallet(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  const txs = await prisma.walletTransaction.findMany({ where: { userId } });
  let credited = 0n;
  let debited = 0n;
  let sum = 0n;
  for (const t of txs) {
    if (!BALANCE_AFFECTING_TX_TYPES.includes(t.type)) continue;
    sum += t.amountUnits;
    if (t.amountUnits > 0n) credited += t.amountUnits;
    else debited += -t.amountUnits;
  }
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      balanceUnits: sum,
      lifetimeCreditedUnits: credited,
      lifetimeDebitedUnits: debited,
    },
  });
}

async function printCounts() {
  const counts = await prisma.$queryRaw<
    Array<{ type: string; count: bigint }>
  >`SELECT type::text, COUNT(*)::bigint as count FROM wallet_transactions GROUP BY type ORDER BY type`;
  console.log('SQL verification:');
  for (const row of counts) {
    console.log(`  ${row.type}: ${row.count}`);
  }
  return counts;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: '+919999990001' } });
  const host = await prisma.user.findFirst({ where: { phone: '+919999990002' } });
  if (!user || !host) throw new Error('Seed users not found');

  const runId = Date.now();

  await reconcileWallet(user.id);
  await reconcileWallet(host.id);

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      razorpayOrderId: `verify_order_${runId}`,
      amountInr: 100,
      totalInr: 118,
      coinUnitsCredited: 10000n,
      status: PaymentStatus.created,
      idempotencyKey: `verify:payment:${runId}`,
    },
  });

  await creditWallet({
    userId: user.id,
    amountUnits: 10000n,
    type: WalletTransactionType.payment_credit,
    referenceType: 'payment',
    referenceId: payment.id,
    idempotencyKey: `payment:credit:${payment.id}`,
    description: 'Payment credit',
  });

  await debitWallet({
    userId: user.id,
    amountUnits: 500n,
    type: WalletTransactionType.call_charge,
    referenceType: 'call',
    idempotencyKey: `verify:call_charge:${runId}`,
    description: 'Verify call charge',
  });

  await debitWallet({
    userId: user.id,
    amountUnits: 1000n,
    type: WalletTransactionType.gift_send,
    referenceType: 'call_gift',
    idempotencyKey: `verify:gift_send:${runId}`,
    description: 'Verify gift send',
  });

  await recordLedgerEntry({
    userId: host.id,
    amountUnits: 700n,
    type: WalletTransactionType.gift_receive,
    referenceType: 'call_gift',
    idempotencyKey: `verify:gift_receive:${runId}`,
    description: 'Verify gift receive',
  });

  await recordLedgerEntry({
    userId: host.id,
    amountUnits: 350n,
    type: WalletTransactionType.call_earning,
    referenceType: 'host_earning',
    idempotencyKey: `verify:call_earning:${runId}`,
    description: 'Verify call earning',
  });

  let bank = await prisma.hostBankAccount.findFirst({ where: { hostId: host.id } });
  if (!bank) {
    bank = await prisma.hostBankAccount.create({
      data: {
        hostId: host.id,
        accountHolderName: 'Verify Host',
        accountNumberEnc: 'hash',
        accountNumberMasked: 'XXXX1234',
        ifscCode: 'HDFC0001234',
        isVerified: true,
        isPrimary: true,
      },
    });
  }

  await prisma.hostProfile.update({
    where: { userId: host.id },
    data: { withdrawableUnits: { increment: 50000n } },
  });

  const withdrawal = await prisma.$transaction(async (tx) => {
    await tx.hostProfile.update({
      where: { userId: host.id },
      data: { withdrawableUnits: { decrement: 50000n } },
    });
    return tx.withdrawal.create({
      data: {
        hostId: host.id,
        bankAccountId: bank!.id,
        amountUnits: 50000n,
        amountInr: 500,
        netInr: 500,
        status: 'requested',
        idempotencyKey: `verify:withdrawal:${runId}`,
      },
    });
  });

  await recordLedgerEntry({
    userId: host.id,
    amountUnits: -50000n,
    type: WalletTransactionType.withdrawal,
    referenceType: 'withdrawal',
    referenceId: withdrawal.id,
    idempotencyKey: `ledger:withdrawal:${withdrawal.id}`,
    description: 'Withdrawal request',
  });

  await printCounts();

  const required = [
    'gift_send',
    'gift_receive',
    'call_charge',
    'call_earning',
    'payment_credit',
    'withdrawal',
    'admin_adjustment',
  ];
  const counts = await prisma.$queryRaw<Array<{ type: string }>>`
    SELECT DISTINCT type::text FROM wallet_transactions
  `;
  const present = new Set(counts.map((c) => c.type));
  const missing = required.filter((t) => !present.has(t));
  if (missing.length > 0) {
    throw new Error(`Missing transaction types: ${missing.join(', ')}`);
  }

  console.log('PASS: all required transaction types present');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());