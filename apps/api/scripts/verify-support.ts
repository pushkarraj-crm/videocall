/**
 * Verifies Operations Panel support tickets endpoint.
 */
import { PrismaClient } from '@prisma/client';
import { verifyApi as api } from './lib/verify-api';

const prisma = new PrismaClient();

async function main() {
  const admin = await api('/auth/dev-login', { method: 'POST', body: { role: 'admin' } });
  const token = admin.accessToken as string;
  const runId = Date.now();

  const ticket = await prisma.grievanceTicket.create({
    data: {
      complainantName: 'Verify User',
      complainantEmail: `verify${runId}@example.com`,
      subject: `Verify ticket ${runId}`,
      description: 'Operations panel verification ticket',
    },
  });

  const list = await api('/admin/operations/support?page=1&limit=10', { token });
  if (!Array.isArray(list.items)) throw new Error('support.items missing');

  const found = (list.items as Array<{ id: string }>).some((t) => t.id === ticket.id);
  if (!found) throw new Error('Created ticket not in support list');

  await api(`/admin/operations/support/${ticket.id}`, {
    method: 'PATCH',
    token,
    body: { notes: 'Acknowledged by verify script', action: 'acknowledge' },
  });

  const updated = await prisma.grievanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });
  if (updated.status !== 'acknowledged') throw new Error('Ticket not acknowledged');

  await api(`/admin/operations/support/${ticket.id}`, {
    method: 'PATCH',
    token,
    body: { notes: 'Resolved by verify script', action: 'resolve' },
  });

  const resolved = await prisma.grievanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });
  if (resolved.status !== 'resolved') throw new Error('Ticket not resolved');

  await prisma.grievanceTicket.delete({ where: { id: ticket.id } });

  console.log(
    JSON.stringify(
      {
        passed: true,
        ticketId: ticket.id,
        openCount: list.openCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());