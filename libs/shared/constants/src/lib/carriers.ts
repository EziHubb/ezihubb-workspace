// ── Fixed carrier list for Delivery profiles ──────────────────────────────────
// Shown in each destination row's "Delivery service" dropdown (Etsy calls
// this "Delivery service"). "OTHER" always stays last and is the only
// option where the seller enters a free-text carrier name + their own
// delivery-time range — every other entry ships with a known SLA.

export interface CarrierServiceOption {
  value:  string;
  label:  string;
  region: 'domestic' | 'international';
}

export const CARRIER_SERVICES: CarrierServiceOption[] = [
  { value: 'GHN',          label: 'Giao Hàng Nhanh (GHN)',        region: 'domestic' },
  { value: 'GHTK',         label: 'Giao Hàng Tiết Kiệm (GHTK)',   region: 'domestic' },
  { value: 'VNPOST',       label: 'Vietnam Post (VNPost)',        region: 'domestic' },
  { value: 'VIETTEL_POST', label: 'Viettel Post',                 region: 'domestic' },
  { value: 'DHL',          label: 'DHL Express',                  region: 'international' },
  { value: 'FEDEX',        label: 'FedEx',                        region: 'international' },
  { value: 'UPS',          label: 'UPS',                          region: 'international' },
  { value: 'OTHER',        label: 'Other',                        region: 'domestic' },
];

export const CARRIER_SERVICE_VALUES = CARRIER_SERVICES.map((c) => c.value);

export function carrierServiceLabel(value: string): string {
  return CARRIER_SERVICES.find((c) => c.value === value)?.label ?? value;
}
