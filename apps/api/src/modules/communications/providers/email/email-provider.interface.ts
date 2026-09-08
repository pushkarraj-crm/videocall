import { EmailSendParams, EmailSendResult } from '../types';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  readonly name: string;
  send(params: EmailSendParams): Promise<EmailSendResult>;
}