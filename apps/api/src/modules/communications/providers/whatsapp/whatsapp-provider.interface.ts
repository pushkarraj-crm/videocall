import { WhatsAppSendParams, WhatsAppSendResult } from '../types';

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

/** Architecture-only interface for future WhatsApp provider plug-in. */
export interface WhatsAppProvider {
  readonly name: string;
  send(params: WhatsAppSendParams): Promise<WhatsAppSendResult>;
}