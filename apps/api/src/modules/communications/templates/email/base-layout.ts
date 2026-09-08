export interface EmailLayoutOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
}

import { APP_TITLE } from '../../../../common/utils/app-brand';

const BRAND_PRIMARY = '#FF2E74';
const BRAND_SECONDARY = '#FF6B9D';
const BRAND_DARK = '#17171C';
const BRAND_LIGHT = '#F8F9FC';

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const preheader = opts.preheader ?? opts.title;
  const supportUrl = opts.supportUrl ?? 'https://platform.app/support';
  const ctaBlock =
    opts.ctaLabel && opts.ctaUrl
      ? `<tr><td style="padding:24px 32px 8px;text-align:center;">
          <a href="${opts.ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px;font-size:15px;">${opts.ctaLabel}</a>
        </td></tr>`
      : '';

  const unsubscribe =
    opts.unsubscribeUrl
      ? `<a href="${opts.unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;">Unsubscribe</a> · `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${opts.title}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #0F0F12 !important; }
      .email-card { background-color: ${BRAND_DARK} !important; color: #F3F4F6 !important; }
      .email-muted { color: #9CA3AF !important; }
    }
    @media only screen and (max-width: 600px) {
      .email-card { padding: 20px !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:${BRAND_LIGHT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND_LIGHT};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">
        <tr><td style="text-align:center;padding-bottom:24px;">
          ${APP_TITLE ? `<div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});line-height:48px;font-size:22px;font-weight:700;color:#fff;">${APP_TITLE.charAt(0).toUpperCase()}</div>
          <div style="margin-top:8px;font-size:18px;font-weight:700;background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_SECONDARY});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${APP_TITLE}</div>` : ''}
        </td></tr>
        <tr><td class="email-card" style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.06);color:#1F2937;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td style="font-size:22px;font-weight:700;padding-bottom:16px;color:inherit;">${opts.title}</td></tr>
            <tr><td style="font-size:15px;line-height:1.6;color:inherit;">${opts.bodyHtml}</td></tr>
            ${ctaBlock}
          </table>
        </td></tr>
        <tr><td class="email-muted" style="text-align:center;padding:24px 16px;font-size:12px;color:#6B7280;line-height:1.6;">
          ${unsubscribe}<a href="${supportUrl}" style="color:#6B7280;text-decoration:underline;">Support</a> ·
          <a href="https://twitter.com" style="color:#6B7280;text-decoration:underline;">Twitter</a> ·
          <a href="https://instagram.com" style="color:#6B7280;text-decoration:underline;">Instagram</a>
          <br/>© ${new Date().getFullYear()}${APP_TITLE ? ` ${APP_TITLE}` : ''}. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}