import { CommunicationChannel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMPLATES = [
  {
    type: 'welcome',
    channel: CommunicationChannel.email,
    title: 'Welcome',
    subject: 'Welcome, {{name}}!',
    body: 'Hi {{name}}, welcome! Start connecting today.',
    htmlBody: null,
    variables: ['name'],
  },
  {
    type: 'recharge_receipt',
    channel: CommunicationChannel.email,
    title: 'Recharge Receipt',
    subject: 'Receipt — ₹{{amount}}',
    body: 'Hi {{name}}, your recharge of ₹{{amount}} for {{coins}} coins on {{date}} was successful. Transaction: {{transactionId}}',
    variables: ['name', 'amount', 'coins', 'date', 'transactionId'],
  },
  {
    type: 'password_reset',
    channel: CommunicationChannel.email,
    title: 'Password Reset',
    subject: 'Reset your password',
    body: 'Hi {{name}}, use this link to reset your password: {{resetUrl}}',
    variables: ['name', 'resetUrl'],
  },
  {
    type: 'withdrawal',
    channel: CommunicationChannel.email,
    title: 'Withdrawal Update',
    subject: 'Withdrawal {{status}} — ₹{{amount}}',
    body: 'Hi {{name}}, your withdrawal of ₹{{amount}} is {{status}}.',
    variables: ['name', 'amount', 'status'],
  },
  {
    type: 'kyc',
    channel: CommunicationChannel.email,
    title: 'KYC Status',
    subject: 'KYC {{status}}',
    body: 'Hi {{name}}, your KYC verification is {{status}}.',
    variables: ['name', 'status'],
  },
  {
    type: 'referral',
    channel: CommunicationChannel.email,
    title: 'Referral Update',
    subject: 'Referral reward — {{coins}} coins',
    body: 'Hi {{name}}, you earned {{coins}} coins from referrals!',
    variables: ['name', 'coins'],
  },
  {
    type: 'promotion',
    channel: CommunicationChannel.email,
    title: 'Special Offer',
    subject: '{{title}}',
    body: 'Hi {{name}}, {{message}} Use coupon: {{coupon}}',
    variables: ['name', 'title', 'message', 'coupon'],
  },
  {
    type: 'otp',
    channel: CommunicationChannel.sms,
    title: 'OTP Verification',
    subject: null,
    body: 'OTP: {{code}}. Valid {{expiresIn}}. Do not share.',
    variables: ['code', 'expiresIn'],
  },
  {
    type: 'recharge_success',
    channel: CommunicationChannel.sms,
    title: 'Recharge Success',
    subject: null,
    body: 'Recharge ₹{{amount}} successful. {{coins}} coins credited.',
    variables: ['amount', 'coins'],
  },
  {
    type: 'withdrawal_update',
    channel: CommunicationChannel.sms,
    title: 'Withdrawal Update',
    subject: null,
    body: 'Withdrawal ₹{{amount}} is {{status}}.',
    variables: ['amount', 'status'],
  },
];

async function main() {
  for (const t of TEMPLATES) {
    await prisma.communicationTemplate.upsert({
      where: { type_channel: { type: t.type, channel: t.channel } },
      create: {
        type: t.type,
        channel: t.channel,
        title: t.title,
        subject: t.subject,
        body: t.body,
        htmlBody: t.htmlBody,
        variables: t.variables,
        isActive: true,
      },
      update: {
        title: t.title,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} communication templates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());