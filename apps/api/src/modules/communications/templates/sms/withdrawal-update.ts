import { smsPrefix } from '../../../../common/utils/app-brand';

export function withdrawalUpdateSmsTemplate(data: { status: string; amountInr: string }) {
  return `${smsPrefix()}Withdrawal of ₹${data.amountInr} is ${data.status}. Check host dashboard for details.`;
}