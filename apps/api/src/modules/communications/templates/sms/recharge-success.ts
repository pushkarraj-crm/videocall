import { smsPrefix } from '../../../../common/utils/app-brand';

export function rechargeSuccessSmsTemplate(data: { amountInr: string; coins: string }) {
  return `${smsPrefix()}Recharge of ₹${data.amountInr} successful. ${data.coins} coins credited.`;
}