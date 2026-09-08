import { smsPrefix } from '../../../../common/utils/app-brand';

export function otpSmsTemplate(data: { code: string; expiresIn?: string }) {
  const expires = data.expiresIn ? ` Valid ${data.expiresIn}.` : '';
  return `${smsPrefix()}OTP: ${data.code}.${expires} Do not share.`;
}