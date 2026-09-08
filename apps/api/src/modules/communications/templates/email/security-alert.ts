import { renderEmailLayout } from './base-layout';

export function securityAlertTemplate(data: {
  name: string;
  alert: string;
  device?: string;
  location?: string;
  time?: string;
}) {
  const subject = 'Security alert on your account';
  const text = `Hi ${data.name}, security alert: ${data.alert}${data.device ? ` Device: ${data.device}` : ''}`;
  const html = renderEmailLayout({
    title: 'Security Alert',
    preheader: data.alert,
    bodyHtml: `<p>Hi ${data.name},</p>
      <p style="padding:12px;background:#FEF3C7;border-radius:8px;color:#92400E;">${data.alert}</p>
      ${data.device ? `<p><strong>Device:</strong> ${data.device}</p>` : ''}
      ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
      ${data.time ? `<p><strong>Time:</strong> ${data.time}</p>` : ''}
      <p>If this wasn't you, secure your account immediately.</p>`,
    ctaLabel: 'Review Account',
    ctaUrl: 'https://platform.app/settings',
  });
  return { subject, text, html };
}