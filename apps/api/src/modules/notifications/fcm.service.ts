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

    // DATA ONLY. A web push carrying a `notification` block is displayed by
    // the browser automatically, and onBackgroundMessage in our worker then
    // drew a second one — which is why a single reply arrived twice. Sending
    // only data leaves exactly one thing capable of putting a notification on
    // screen, and it is the one that knows the right icon, the right click
    // target and the unread count for the app badge.
    //
    // The trade is real: with no notification block the browser has no
    // fallback to display if the worker fails, so the worker must always end
    // up calling showNotification.
    //
    // Title and body move into data because that is now the only channel
    // carrying them. Every value here has to be a string — FCM rejects the
    // message otherwise — so an absent imageUrl is omitted rather than sent
    // as undefined.
    const message: MulticastMessage = {
      tokens,
      data: {
        ...(payload.data ?? {}),
        title: payload.title,
        body:  payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        clickAction: payload.clickAction ?? '/',
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
