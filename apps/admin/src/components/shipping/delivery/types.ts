// ── Delivery settings (Etsy-parity) — shared types ────────────────────────────

export type ProcessingProfileType = 'MADE_TO_ORDER' | 'READY_TO_SHIP';

export interface ProcessingProfile {
  id:             string;
  name:           string;
  type:           ProcessingProfileType;
  minDays:        number;
  maxDays:        number;
  isDefault:      boolean;
  storeId:        string | null;
}

export type ShippingChargeType = 'FIXED' | 'FREE';

export interface ShippingProfileMethodRow {
  id?:             string;
  destinationType: string; // 'domestic' | 'everywhere_else' | ISO country code
  carrierService:  string;
  carrierName?:    string | null;
  chargeType:      ShippingChargeType;
  minDays:         number;
  maxDays:         number;
  price?:          number | null;
  extraItemPrice?: number | null;
}

export interface ShippingProfile {
  id:               string;
  name:             string;
  originCountry:    string;
  originPostalCode: string;
  activeListings:   number;
  isDefault:        boolean;
  storeId:          string | null;
  methods:          ShippingProfileMethodRow[];
}

export const DOMESTIC   = 'domestic';
export const EVERYWHERE_ELSE = 'everywhere_else';
