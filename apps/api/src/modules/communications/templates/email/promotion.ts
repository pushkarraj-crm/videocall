import { renderEmailLayout } from './base-layout';

export function promotionEmailTemplate(data: {
  name: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const subject = data.title;
  const text = `Hi ${data.name}, ${data.message}`;
  const html = renderEmailLayout({
    title: data.title,
    preheader: data.message.slice(0, 100),
    bodyHtml: `<p>Hi ${data.name},</p><p>${data.message}</p>`,
    ctaLabel: data.ctaLabel ?? 'Claim Offer',
    ctaUrl: data.ctaUrl ?? 'https://platform.app/wallet/purchase',
  });
  return { subject, text, html };
}