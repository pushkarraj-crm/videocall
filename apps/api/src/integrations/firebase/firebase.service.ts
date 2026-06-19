import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY', '')
      .replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new Error('Firebase credentials are required in production');
      }
      return;
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) {
      throw new BusinessException(
        'Firebase is not configured',
        503,
        'FIREBASE_NOT_CONFIGURED',
      );
    }

    try {
      return await admin.auth().verifyIdToken(idToken, true);
    } catch {
      throw new BusinessException('Invalid Firebase token', 401, 'INVALID_FIREBASE_TOKEN');
    }
  }
}