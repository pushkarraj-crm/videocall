export interface EmailSendParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailSendResult {
  success: boolean;
  providerId?: string;
  response?: Record<string, unknown>;
  error?: string;
}

export interface SmsSendParams {
  to: string;
  body: string;
  unicode?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SmsSendResult {
  success: boolean;
  providerId?: string;
  response?: Record<string, unknown>;
  error?: string;
}

export interface WhatsAppSendParams {
  to: string;
  body: string;
  templateKey?: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppSendResult {
  success: boolean;
  providerId?: string;
  response?: Record<string, unknown>;
  error?: string;
}