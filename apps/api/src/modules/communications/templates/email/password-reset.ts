import { renderEmailLayout } from './base-layout';

export function passwordResetTemplate(data: { name: string; resetUrl: string; expiresIn?: string }) {
  const subject = 'Reset your password';
  const text = `Hi ${data.name}, reset your password: ${data.resetUrl}${data.expiresIn ? ` (expires in ${data.expiresIn})` : ''}`;
  const html = renderEmailLayout({
    title: 'Password Reset',
    preheader: 'Reset your password',
    bodyHtml: `<p>Hi ${data.name},</p>
      <p>We received a request to reset your password. Click below to choose a new one.</p>
      ${data.expiresIn ? `<p style="color:#6B7280;font-size:13px;">This link expires in ${data.expiresIn}.</p>` : ''}`,
    ctaLabel: 'Reset Password',
    ctaUrl: data.resetUrl,
  });
  return { subject, text, html };
}