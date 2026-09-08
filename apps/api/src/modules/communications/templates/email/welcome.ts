import { APP_TITLE } from '../../../../common/utils/app-brand';
import { renderEmailLayout } from './base-layout';

export function welcomeEmailTemplate(data: { name: string; appUrl?: string }) {
  const appUrl = data.appUrl ?? 'https://platform.app';
  const brand = APP_TITLE || 'our app';
  const subject = APP_TITLE
    ? `Welcome to ${APP_TITLE}, ${data.name}!`
    : `Welcome, ${data.name}!`;
  const text = `Hi ${data.name}, welcome to ${brand}! Start connecting with hosts and enjoy premium video calls. Visit ${appUrl}`;
  const html = renderEmailLayout({
    title: `Welcome, ${data.name}! 🎉`,
    preheader: 'Your account is ready — start exploring.',
    bodyHtml: `<p>We're thrilled to have you${APP_TITLE ? ` on ${APP_TITLE}` : ''}. Discover hosts, make calls, and recharge your wallet anytime.</p>
      <p style="margin-top:16px;">Your journey starts now.</p>`,
    ctaLabel: APP_TITLE ? `Open ${APP_TITLE}` : 'Get started',
    ctaUrl: appUrl,
  });
  return { subject, text, html };
}