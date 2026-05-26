import { useState } from "react";
import { X } from "lucide-react";

interface OrderSummaryProps {
  subtotal: number;
  itemCount: number;
  discount?: number;
  appliedCoupon?: string;
  onCheckout?: () => void;
  className?: string;
}

export function OrderSummary({
  subtotal,
  itemCount,
  discount = 0,
  appliedCoupon: initialCoupon = "",
  onCheckout,
  className = "",
}: OrderSummaryProps) {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(initialCoupon);
  const [couponError, setCouponError] = useState("");

  const total = subtotal - discount;

  const handleApplyCoupon = () => {
    // Simple validation
    if (couponCode.trim() === "") {
      setCouponError("Please enter a coupon code");
      return;
    }

    // Mock validation - in real app this would be an API call
    if (couponCode.toUpperCase() === "WELCOME10") {
      setAppliedCoupon(couponCode.toUpperCase());
      setCouponCode("");
      setCouponError("");
    } else {
      setCouponError("Invalid coupon code");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon("");
    setCouponError("");
  };

  return (
    <div
      className={`bg-white rounded-2xl md:rounded-xl p-4 md:p-6 shadow-lg ${className}`}
    >
      <h4 className="font-semibold text-lg mb-6">Order Summary</h4>

      {/* Line Items */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">
            Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
          <span className="font-medium">${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Shipping</span>
          <span className="text-[var(--color-text-muted)] italic text-xs">
            Calculated at checkout
          </span>
        </div>

        {discount > 0 && appliedCoupon && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-muted)]">
              Discount ({appliedCoupon})
            </span>
            <span className="font-medium text-[var(--color-success)]">
              -${discount.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--color-border)] my-4" />

      {/* Total */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-xl">Total</span>
        <span className="font-bold text-2xl">${total.toFixed(2)}</span>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] mb-6">
        Tax included. Shipping calculated at checkout.
      </p>

      {/* Coupon Section */}
      <div className="mb-6">
        <label className="block font-semibold text-sm mb-2">Promo Code</label>

        {appliedCoupon ? (
          /* Applied State */
          <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-success)]/10 border border-[var(--color-success)] rounded-lg">
            <span className="flex-1 font-medium text-sm">
              ✓ {appliedCoupon}
            </span>
            <button
              onClick={handleRemoveCoupon}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Default State */
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setCouponError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                placeholder="Enter code"
                className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <button
                onClick={handleApplyCoupon}
                className="px-6 py-2 border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white rounded-lg font-semibold text-sm transition-colors uppercase tracking-wide"
              >
                Apply
              </button>
            </div>
            {couponError && (
              <p className="text-xs text-[var(--color-error)] mt-2">
                {couponError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Checkout Button */}
      <button
        onClick={onCheckout}
        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-4 rounded-lg transition-colors text-base uppercase tracking-wide mb-4"
      >
        Proceed to Checkout
      </button>

      {/* Trust Row */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-xs text-[var(--color-text-muted)] mb-4">
        <div className="flex items-center gap-2">
          <span>🔒</span>
          <span>Secure Payment</span>
        </div>
        <div className="hidden md:block text-[var(--color-border)]">|</div>
        <div className="flex items-center gap-2">
          <span>↩️</span>
          <span>Easy Returns</span>
        </div>
        <div className="hidden md:block text-[var(--color-border)]">|</div>
        <div className="flex items-center gap-2">
          <span>📞</span>
          <span>24/7 Support</span>
        </div>
      </div>

      {/* Payment Icons */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <div className="px-3 py-1.5 bg-gray-100 rounded text-xs font-semibold text-gray-600">
          VISA
        </div>
        <div className="px-3 py-1.5 bg-gray-100 rounded text-xs font-semibold text-gray-600">
          MC
        </div>
        <div className="px-3 py-1.5 bg-gray-100 rounded text-xs font-semibold text-gray-600">
          AMEX
        </div>
        <div className="px-3 py-1.5 bg-gray-100 rounded text-xs font-semibold text-gray-600">
          PayPal
        </div>
        <div className="px-3 py-1.5 bg-gray-100 rounded text-xs font-semibold text-gray-600">
           Pay
        </div>
      </div>
    </div>
  );
}
