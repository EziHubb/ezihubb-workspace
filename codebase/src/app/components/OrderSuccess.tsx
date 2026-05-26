import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface OrderItem {
  id: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface OrderSuccessProps {
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  shippingAddress: {
    name: string;
    line1: string;
    line2: string;
  };
  estimatedDelivery: string;
}

export function OrderSuccess({
  orderNumber,
  customerName,
  items,
  subtotal,
  shipping,
  discount,
  shippingAddress,
  estimatedDelivery,
}: OrderSuccessProps) {
  const [copied, setCopied] = useState(false);

  const total = subtotal + shipping - discount;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedItems = items.slice(0, 3);
  const remainingCount = items.length - 3;

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Simplified Navbar */}
      <header className="bg-white border-b border-[var(--color-border)] py-4 md:py-5">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl font-['Playfair_Display']">
                  M
                </span>
              </div>
              <span className="font-['Playfair_Display'] font-bold text-xl text-[var(--color-secondary)]">
                Macorner
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[600px] mx-auto px-4 md:px-8 py-12 md:py-16 pb-20 md:pb-20">
        {/* Success Icon with Confetti */}
        <div className="relative flex justify-center mb-6">
          {/* Confetti Decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-3 h-3 bg-[var(--color-primary)] rounded-full animate-pulse" />
            <div className="absolute top-4 right-1/4 w-2 h-2 bg-[var(--color-warning)] rotate-45" />
            <div className="absolute top-8 left-1/3 w-2.5 h-2.5 bg-[var(--color-badge-new)] rounded-full" />
            <div className="absolute top-2 right-1/3 w-2 h-2 bg-[var(--color-error)] rotate-12" />
            <div className="absolute top-12 left-1/2 w-2 h-2 bg-[var(--color-warning)] rounded-full animate-pulse" />
            <div className="absolute top-6 right-1/2 w-2.5 h-2.5 bg-[var(--color-primary)] rotate-45" />
          </div>

          {/* Success Circle */}
          <div className="w-20 h-20 md:w-24 md:h-24 bg-[var(--color-success)] rounded-full flex items-center justify-center shadow-lg relative z-10">
            <Check className="w-12 h-12 md:w-14 md:h-14 text-white stroke-[3]" />
          </div>
        </div>

        {/* Success Message */}
        <h2 className="font-['Playfair_Display'] font-bold text-2xl md:text-3xl text-center text-[var(--color-secondary)] mb-2">
          Order Confirmed! 🎉
        </h2>
        <p className="text-center text-[var(--color-text-muted)] mb-3">
          Thank you, {customerName}! We've received your order and started
          making your gifts.
        </p>

        {/* Order Number */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
            <span className="font-mono text-sm md:text-base font-medium">
              Order #{orderNumber}
            </span>
            <button
              onClick={handleCopyOrderNumber}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label="Copy order number"
            >
              {copied ? (
                <Check className="w-4 h-4 text-[var(--color-success)]" />
              ) : (
                <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
              )}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--color-border)] mb-8" />

        {/* Order Summary Card */}
        <div className="bg-white rounded-2xl md:rounded-xl p-5 md:p-6 shadow-md mb-8">
          <h5 className="font-semibold text-lg mb-4">Order Summary</h5>

          {/* Item Thumbnails */}
          <div className="flex items-center gap-2 mb-4">
            {displayedItems.map((item) => (
              <img
                key={item.id}
                src={item.image}
                alt={item.name}
                className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover"
              />
            ))}
            {remainingCount > 0 && (
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-semibold text-[var(--color-text-muted)]">
                +{remainingCount}
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">
                Items ({itemCount})
              </span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">
                Shipping (Express)
              </span>
              <span>${shipping.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">
                  Discount
                </span>
                <span className="text-[var(--color-success)]">
                  -${discount.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border)] mb-4" />

          {/* Total */}
          <div className="flex justify-between mb-4">
            <span className="font-semibold text-base">Total</span>
            <span className="font-bold text-xl">${total.toFixed(2)}</span>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border)] mb-4" />

          {/* Shipping Info */}
          <div className="mb-3">
            <p className="text-sm font-medium mb-1">Ship to:</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {shippingAddress.name}
              <br />
              {shippingAddress.line1}
              <br />
              {shippingAddress.line2}
            </p>
          </div>

          {/* Delivery Estimate */}
          <div className="bg-[var(--color-background)] rounded-lg p-3">
            <p className="text-sm font-semibold">
              📅 {estimatedDelivery}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Estimated delivery
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-6">
          <a
            href="/track-order"
            className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-4 rounded-lg transition-colors text-center uppercase tracking-wide"
          >
            Track My Order
          </a>
          <a
            href="/"
            className="flex-1 border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] font-semibold py-4 rounded-lg transition-colors text-center uppercase tracking-wide"
          >
            Continue Shopping
          </a>
        </div>

        {/* Support Note */}
        <p className="text-xs text-center text-[var(--color-text-muted)]">
          Questions? Email{" "}
          <a
            href="mailto:support@macorner.co"
            className="text-[var(--color-primary)] hover:underline"
          >
            support@macorner.co
          </a>{" "}
          or chat with us
        </p>
      </main>
    </div>
  );
}
