export interface ShippingZoneDto {
  id:        string;
  name:      string;
  countries: string[];
  methods?:  ShippingMethodDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ShippingMethodDto {
  id:                string;
  zoneId:            string;
  name:              string;
  carrier?:          string;
  price:             number;
  freeShippingOver?: number;
  minDays:           number;
  maxDays:           number;
  isActive:          boolean;
  createdAt:         string;
  updatedAt:         string;
}

export interface ShippingOptionDto {
  methodId:          string;
  name:              string;
  carrier?:          string;
  price:             number;
  isFree:            boolean;
  freeShippingOver?: number;
  minDays:           number;
  maxDays:           number;
  estimatedDelivery: string;
}
