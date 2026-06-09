import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { MulticastMessage } from 'firebase-admin/messaging';

export interface FcmSendResult {
  sent:        number;
  failed:      number;
  staleTokens: string[];
}

export interface FcmPayload {
  title:        string;
  body:         string;
  imageUrl?:    string;
  data?:        Record<string, string>;
  clickAction?: string;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly messaging: admin.messaging.Messaging | null = null;

  constructor() {
    const serviceAccount = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
    if (serviceAccount) {
      try {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount) as admin.ServiceAccount),
          });
        }
        this.messaging = admin.messaging();
        this.logger.log('Firebase Admin initialized');
      } catch (err) {
        this.logger.error(`Firebase Admin init failed: ${String(err)}`);
      }
    } else {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push disabled');
    }
  }

  async sendToTokens(tokens: string[], payload: FcmPayload): Promise<FcmSendResult> {
    if (!this.messaging || tokens.length === 0) {
      return { sent: 0, failed: 0, staleTokens: [] };
    }

    const message: MulticastMessage = {
      tokens,
      notification: {
        title:    payload.title,
        body:     payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        ...(payload.data ?? {}),
        clickAction: payload.clickAction ?? '/',
      },
      webpush: {
        fcmOptions: { link: payload.clickAction ?? '/' },
        notification: {
          icon:               '/icons/icon-192x192.png',
          badge:              '/icons/badge-72x72.png',
          requireInteraction: false,
        },
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
    };

    try {
      const response = await this.messaging.sendEachForMulticast(message);

      const staleTokens = response.responses
        .map((r, i) => ({ token: tokens[i], error: r.error?.code }))
        .filter((f) => f.error === 'messaging/registration-token-not-registered')
        .map((f) => f.token);

      return {
        sent:        response.successCount,
        failed:      response.failureCount,
        staleTokens,
      };
    } catch (err) {
      this.logger.error(`FCM multicast failed: ${String(err)}`);
      return { sent: 0, failed: tokens.length, staleTokens: [] };
    }
  }
}
