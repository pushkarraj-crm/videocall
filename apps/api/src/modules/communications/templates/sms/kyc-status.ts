import { smsPrefix } from '../../../../common/utils/app-brand';

export function kycStatusSmsTemplate(data: { status: string }) {
  return `${smsPrefix()}Your KYC verification is ${data.status}. Open the app for details.`;
}