import { smsPrefix } from '../../../../common/utils/app-brand';

export function securityAlertSmsTemplate(data: { alert: string }) {
  return `${smsPrefix()}Security: ${data.alert} If not you, secure your account immediately.`;
}