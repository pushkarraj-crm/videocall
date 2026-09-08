import { renderEmailLayout } from './base-layout';

export function kycEmailTemplate(data: { name: string; status: string; reason?: string }) {
  const subject = `KYC ${data.status}`;
  const text = `Hi ${data.name}, your KYC verification is ${data.status}.${data.reason ? ` Reason: ${data.reason}` : ''}`;
  const html = renderEmailLayout({
    title: `KYC ${data.status}`,
    preheader: `Verification status: ${data.status}`,
    bodyHtml: `<p>Hi ${data.name},</p>
      <p>Your host KYC verification is <strong>${data.status}</strong>.</p>
      ${data.reason ? `<p style="margin-top:12px;padding:12px;background:#FEF2F2;border-radius:8px;color:#991B1B;">${data.reason}</p>` : ''}`,
    ctaLabel: 'View KYC Status',
    ctaUrl: 'https://platform.app/host/dashboard',
  });
  return { subject, text, html };
}