import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

// Ordered by specificity — USPS checked before generic 20-digit patterns
const CARRIER_PATTERNS: [string, RegExp[]][] = [
  ['USPS', [
    /^94[0-9]{20}$/,
    /^9[0-9]{15,21}$/,
    /^[A-Z]{2}[0-9]{9}US$/i,
    /^[0-9]{22}$/,
  ]],
  ['UPS', [
    /^1Z[A-Z0-9]{16}$/i,
  ]],
  ['FEDEX', [
    /^[0-9]{12}$/,
    /^[0-9]{15}$/,
    /^96[0-9]{20}$/,
    /^[0-9]{20}$/,
  ]],
  ['DHL', [
    /^\d{10}$/,
    /^JD[0-9]{18}$/i,
    /^[A-Z]{3}\d{7}[A-Z]$/i,
  ]],
];

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.easypost.com/v2';

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('EASYPOST_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('EASYPOST_API_KEY not set — live tracking disabled');
    }
  }

  detectCarrier(trackingNumber: string): string {
    if (!trackingNumber) return 'OTHER';
    const tn = trackingNumber.trim().toUpperCase();
    for (const [carrier, patterns] of CARRIER_PATTERNS) {
      if (patterns.some((p) => p.test(tn))) return carrier;
    }
    return 'OTHER';
  }

  buildTrackingUrl(carrier: string, trackingNumber: string): string {
    const c = carrier.toUpperCase();
    if (c === 'USPS')
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    if (c === 'FEDEX')
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    if (c === 'UPS')
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    if (c === 'DHL')
      return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
    return `https://t.17track.net/en#nums=${trackingNumber}`;
  }

  async registerTracker(trackingNumber: string, carrier: string): Promise<string | null> {
    if (!this.apiKey) return null;

    interface EasyPostTrackerResponse { tracker: { id: string; status: string } }
    try {
      const { data } = await axios.post<EasyPostTrackerResponse>(
        `${this.baseUrl}/trackers`,
        {
          tracker: {
            tracking_code: trackingNumber,
            ...(carrier !== 'OTHER' && { carrier }),
          },
        },
        {
          auth:    { username: this.apiKey, password: '' },
          headers: { 'Content-Type': 'application/json' },
          timeout: 10_000,
        },
      );
      this.logger.log(`EasyPost tracker created: ${data.tracker.id} for ${trackingNumber}`);
      return data.tracker.id;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number }; message?: string };
      this.logger.warn(
        `EasyPost tracker registration failed (${axiosErr.response?.status ?? 'no response'}): ${axiosErr.message}`,
      );
      return null;
    }
  }

  parseWebhookEvent(
    body: unknown,
  ): { trackerId: string; status: string; trackingCode: string | null } | null {
    const evt = body as {
      description?: string;
      result?: { id?: string; status?: string; tracking_code?: string };
    };
    if (!evt.description?.startsWith('tracker.')) return null;
    if (!evt.result?.id || !evt.result?.status) return null;
    return {
      trackerId:    evt.result.id,
      status:       evt.result.status,
      trackingCode: evt.result.tracking_code ?? null,
    };
  }
}
