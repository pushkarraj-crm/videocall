import { renderEmailLayout } from './base-layout';

export function withdrawalEmailTemplate(data: {
  name: string;
  status: string;
  amountInr: string;
  note?: string;
}) {
  const subject = `Withdrawal ${data.status} — ₹${data.amountInr}`;
  const text = `Hi ${data.name}, your withdrawal of ₹${data.amountInr} is ${data.status}.${data.note ? ` Note: ${data.note}` : ''}`;
  const html = renderEmailLayout({
    title: `Withdrawal ${data.status}`,
    preheader: `₹${data.amountInr} withdrawal update`,
    bodyHtml: `<p>Hi ${data.name},</p>
      <p>Your withdrawal request for <strong>₹${data.amountInr}</strong> is now <strong>${data.status}</strong>.</p>
      ${data.note ? `<p style="margin-top:12px;color:#6B7280;">${data.note}</p>` : ''}`,
    ctaLabel: 'Host Dashboard',
    ctaUrl: 'https://platform.app/host/dashboard',
  });
  return { subject, text, html };
}