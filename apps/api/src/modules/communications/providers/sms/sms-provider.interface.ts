import { SmsSendParams, SmsSendResult } from '../types';

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsProvider {
  readonly name: string;
  send(params: SmsSendParams): Promise<SmsSendResult>;
}