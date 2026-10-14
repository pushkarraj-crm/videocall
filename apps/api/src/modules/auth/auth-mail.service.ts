import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createTransport } from 'nodemailer';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class AuthMailService {
  constructor(private readonly config: ConfigService) {}

  assertAvailable() {
    if (this.config.get('NODE_ENV') === 'production' &&
        (!this.config.get('SMTP_HOST') || !this.config.get('EMAIL_FROM'))) {
      throw new BusinessException('Email delivery is unavailable. Please contact support.', 503, 'EMAIL_UNAVAILABLE');
    }
  }

  async send(to: string, subject: string, text: string) {
    this.assertAvailable();
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      // A local inbox, never a public response or log containing recovery secrets.
      const directory = join(process.cwd(), '.local', 'auth-mail');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(join(directory, `${Date.now()}-${randomUUID()}.json`),
        JSON.stringify({ to, subject, text }, null, 2), { mode: 0o600 });
      return;
    }
    const port = Number(this.config.get('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const transport = createTransport({
      host, port, secure: port === 465,
      auth: user ? { user, pass: this.config.get<string>('SMTP_PASS') } : undefined,
      connectionTimeout: 10000, socketTimeout: 10000,
    });
    const result = await transport.sendMail({
      from: this.config.get<string>('EMAIL_FROM'), to, subject, text,
    });
    if (!result.accepted?.length) throw new Error('Email delivery failed');
  }

  link(path: string, token: string) {
    const origin = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    // Fragments stay out of HTTP access logs and Referer headers.
    return `${origin.replace(/\/$/, '')}/login/${path}#token=${token}`;
  }
}
