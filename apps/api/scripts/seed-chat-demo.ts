import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  const hostId = process.argv[3];

  if (!userId || !hostId) {
    throw new Error('Usage: seed-chat-demo.ts <userId> <hostId>');
  }

  const [participantAId, participantBId] = [userId, hostId].sort();

  const conv = await prisma.conversation.upsert({
    where: { participantAId_participantBId: { participantAId, participantBId } },
    update: {},
    create: { participantAId, participantBId },
  });

  const msgs = [
    { senderId: hostId, content: 'Hey are you free? 👋' },
    { senderId: userId, content: 'Hi! Yes, just finished a call.' },
    { senderId: hostId, content: 'Want to chat for a bit?' },
    { senderId: userId, content: 'Sure, sounds good!' },
  ];

  for (const m of msgs) {
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: m.senderId,
        content: m.content,
        moderationStatus: 'approved',
      },
    });
  }

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: 'Sure, sounds good!' },
  });

  await prisma.user.update({
    where: { id: hostId },
    data: { lastSeenAt: new Date() },
  });

  console.log(conv.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());