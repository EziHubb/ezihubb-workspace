import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingService } from './tracking.service';

interface ShippingRate {
  id:           string;
  carrier:      string;
  service:      string;
  price:        number;
  deliveryDays?: number;
  currency:     string;
}

interface EasyPostRate {
  id:             string;
  carrier:        string;
  service:        string;
  rate:           string;
  delivery_days?: number;
  currency?:      string;
}

interface EasyPostShipment {
  id:              string;
  rates?:          EasyPostRate[];
  tracking_code?:  string;
  postage_label?:  { label_url?: string };
  selected_rate?:  { carrier?: string; rate?: string };
}

@Injectable()
export class LabelService {
  private readonly logger  = new Logger(LabelService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.easypost.com/v2';

  private readonly fromAddress = {
    name:    process.env['WAREHOUSE_NAME']   ?? 'EziHubb',
    street1: process.env['WAREHOUSE_STREET'] ?? '123 Main St',
    city:    process.env['WAREHOUSE_CITY']   ?? 'New York',
    state:   process.env['WAREHOUSE_STATE']  ?? 'NY',
    zip:     process.env['WAREHOUSE_ZIP']    ?? '10001',
    country: 'US',
    phone:   process.env['WAREHOUSE_PHONE']  ?? '',
  };

  constructor(
    private readonly config:          ConfigService,
    private readonly prisma:          PrismaService,
    private readonly trackingService: TrackingService,
  ) {
    this.apiKey = config.get<string>('EASYPOST_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('EASYPOST_API_KEY not set — label purchase disabled');
    }
  }

  private get auth() {
    return { username: this.apiKey, password: '' };
  }

  async getRates(orderId: string): Promise<ShippingRate[]> {
    if (!this.apiKey) throw new BadRequestException('EasyPost not configured');

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        shippingName:       true,
        shippingAddress:    true,
        shippingCity:       true,
        shippingState:      true,
        shippingZip:        true,
        shippingCountry:    true,
        easypostShipmentId: true,
      },
    });

    // Reuse existing shipment — rates are already fetched
    if (order.easypostShipmentId) {
      const { data: existing } = await axios.get<EasyPostShipment>(
        `${this.baseUrl}/shipments/${order.easypostShipmentId}`,
        { auth: this.auth, timeout: 15_000 },
      );
      return this.formatRates(existing.rates ?? []);
    }

    // shippingAddress may be a JSON blob; extract street1 from it. Label
    // purchasing is a physical-shipping-only feature — a digital order (whose
    // shipping columns are null) would never reach this code path.
    let street1 = order.shippingAddress ?? '';
    try {
      const parsed = JSON.parse(street1) as { addressLine1?: string };
      if (parsed.addressLine1) street1 = parsed.addressLine1;
    } catch { /* use raw string as street1 */ }

    const { data: shipment } = await axios.post<EasyPostShipment>(
      `${this.baseUrl}/shipments`,
      {
        shipment: {
          to_address: {
            name:    order.shippingName,
            street1,
            city:    order.shippingCity,
            state:   order.shippingState ?? undefined,
            zip:     order.shippingZip,
            country: order.shippingCountry,
          },
          from_address: this.fromAddress,
          parcel: {
            // Default mug parcel — adjust per product type as needed
            length: 10, width: 8, height: 4,
            weight: 8, // oz (0.5 lb)
          },
        },
      },
      { auth: this.auth, timeout: 15_000 },
    );

    await this.prisma.order.update({
      where: { id: orderId },
      data:  { easypostShipmentId: shipment.id },
    });

    return this.formatRates(shipment.rates ?? []);
  }

  async purchaseLabel(orderId: string, rateId: string): Promise<{
    labelUrl:       string;
    trackingNumber: string;
    trackingUrl:    string;
    carrier:        string;
    cost:           number;
  }> {
    if (!this.apiKey) throw new BadRequestException('EasyPost not configured');

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { easypostShipmentId: true, labelUrl: true },
    });

    if (order.labelUrl) {
      throw new BadRequestException('Label already purchased for this order');
    }
    if (!order.easypostShipmentId) {
      throw new BadRequestException('Call getRates first to create a shipment');
    }

    const { data: shipment } = await axios.post<EasyPostShipment>(
      `${this.baseUrl}/shipments/${order.easypostShipmentId}/buy`,
      { rate: { id: rateId } },
      { auth: this.auth, timeout: 15_000 },
    );

    if (!shipment.tracking_code || !shipment.postage_label?.label_url) {
      throw new Error('EasyPost label purchase failed — no label URL returned');
    }

    const carrier    = shipment.selected_rate?.carrier
      ?? this.trackingService.detectCarrier(shipment.tracking_code);
    const trackingUrl = this.trackingService.buildTrackingUrl(carrier, shipment.tracking_code);

    const trackerId = await this.trackingService.registerTracker(
      shipment.tracking_code,
      carrier,
    );

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status:           'SHIPPED',
        trackingNumber:   shipment.tracking_code,
        trackingUrl,
        carrier,
        trackerId,
        labelUrl:         shipment.postage_label.label_url,
        labelCost:        Number(shipment.selected_rate?.rate ?? 0),
        labelPurchasedAt: new Date(),
        shippedAt:        new Date(),
        shippingRateId:   rateId,
      },
    });

    this.logger.log(
      `Label purchased for order ${orderId}: ${shipment.tracking_code} via ${carrier}`,
    );

    return {
      labelUrl:       shipment.postage_label.label_url,
      trackingNumber: shipment.tracking_code,
      trackingUrl,
      carrier,
      cost:           Number(shipment.selected_rate?.rate ?? 0),
    };
  }

  private formatRates(rates: EasyPostRate[]): ShippingRate[] {
    return rates
      .filter((r) => r.rate)
      .sort((a, b) => Number(a.rate) - Number(b.rate))
      .map((r) => ({
        id:           r.id,
        carrier:      r.carrier,
        service:      r.service,
        price:        Number(r.rate),
        deliveryDays: r.delivery_days,
        currency:     r.currency ?? 'USD',
      }));
  }
}
