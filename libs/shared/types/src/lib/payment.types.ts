export type PaymentStatus   = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentProvider = 'STRIPE' | 'PAYPAL' | 'GIFT_CARD';

export interface PaymentDto {
  id:                string;
  orderId:           string;
  provider:          PaymentProvider;
  providerPaymentId?: string;
  amount:            number;
  currency:          string;
  status:            PaymentStatus;
  metadata?:         Record<string, unknown>;
  createdAt:         string;
  updatedAt:         string;
}

export interface GiftCardDto {
  id:              string;
  code:            string;
  initialBalance:  number;
  currentBalance:  number;
  currency:        string;
  isActive:        boolean;
  expiresAt?:      string;
  purchasedByUser?: string;
  recipientEmail?:  string;
  recipientName?:   string;
  message?:         string;
  createdAt:        string;
}

export interface CheckoutIntentDto {
  clientSecret:    string;
  paymentIntentId: string;
  amount:          number;
  currency:        string;
}
