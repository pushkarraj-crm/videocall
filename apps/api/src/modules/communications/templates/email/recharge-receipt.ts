import { renderEmailLayout } from './base-layout';

export function rechargeReceiptTemplate(data: {
  name: string;
  amountInr: string;
  coins: string;
  invoiceNumber?: string;
  paidAt?: string;
}) {
  const subject = `Recharge receipt — ₹${data.amountInr}`;
  const text = `Hi ${data.name}, your recharge of ₹${data.amountInr} for ${data.coins} coins was successful.${data.invoiceNumber ? ` Invoice: ${data.invoiceNumber}` : ''}`;
  const html = renderEmailLayout({
    title: 'Recharge Successful',
    preheader: `₹${data.amountInr} credited to your wallet`,
    bodyHtml: `<p>Hi ${data.name},</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#6B7280;">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600;">₹${data.amountInr}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7280;">Coins</td><td style="padding:8px 0;text-align:right;font-weight:600;">${data.coins}</td></tr>
        ${data.invoiceNumber ? `<tr><td style="padding:8px 0;color:#6B7280;">Invoice</td><td style="padding:8px 0;text-align:right;">${data.invoiceNumber}</td></tr>` : ''}
        ${data.paidAt ? `<tr><td style="padding:8px 0;color:#6B7280;">Date</td><td style="padding:8px 0;text-align:right;">${data.paidAt}</td></tr>` : ''}
      </table>
      <p>Thank you for your purchase!</p>`,
    ctaLabel: 'View Wallet',
    ctaUrl: 'https://platform.app/wallet',
  });
  return { subject, text, html };
}