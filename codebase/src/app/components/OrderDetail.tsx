import { ChevronLeft, Download, Printer, Package } from "lucide-react";
import { AccountLayout } from "./AccountLayout";
import { StatusTimeline } from "./StatusTimeline";

interface OrderItem {
  id: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  customization?: {
    text?: string;
    photo?: string;
    style?: string;
  };
}

const mockOrder = {
  orderNumber: "MC-2024-04521",
  placedDate: "June 1, 2024",
  status: "Shipped",
  items: [
    {
      id: 1,
      name: "Custom Name & Photo Coffee Mug",
      image: "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200",
      price: 27.99,
      quantity: 2,
      customization: {
        text: "Best Dad Ever",
        photo: "Uploaded photo",
        style: "Watercolor",
      },
    },
    {
      id: 2,
      name: "Personalized Canvas Print",
      image: "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200",
      price: 49.99,
      quantity: 1,
      customization: {
        text: "The Johnson Family",
      },
    },
    {
      id: 3,
      name: "Monogram Tumbler",
      image: "https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=200",
      price: 29.99,
      quantity: 1,
      customization: {
        text: "SJ",
      },
    },
  ],
  subtotal: 135.96,
  shipping: 12.99,
  discount: 9.0,
  total: 123.97,
  paymentMethod: "Visa ending in 4242",
  shippingAddress: {
    name: "Sarah Johnson",
    line1: "123 Main Street, Apt 4B",
    line2: "San Francisco, CA 94102",
    phone: "(555) 123-4567",
  },
  billingAddress: {
    name: "Sarah Johnson",
    line1: "123 Main Street, Apt 4B",
    line2: "San Francisco, CA 94102",
  },
  timeline: [
    {
      status: "completed" as const,
      label: "Order Confirmed",
      date: "June 1, 2024",
    },
    {
      status: "completed" as const,
      label: "In Production",
      date: "June 2, 2024",
    },
    {
      status: "current" as const,
      label: "Shipped",
      date: "June 3, 2024",
      trackingInfo: {
        carrier: "FedEx",
        trackingNumber: "794644792798",
        trackingUrl: "https://fedex.com/track",
      },
    },
    {
      status: "upcoming" as const,
      label: "Delivered",
      date: "Est. June 5–10, 2024",
    },
  ],
};

export function OrderDetail() {
  return (
    <AccountLayout activePage="order-detail">
      <div className="space-y-6">
        {/* Back Button */}
        <a
          href="#orders"
          className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Orders
        </a>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-2xl mb-1">
              Order #{mockOrder.orderNumber}
            </h3>
            <p className="text-[var(--color-text-muted)]">
              Placed on {mockOrder.placedDate}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors font-medium">
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Download Invoice</span>
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors font-medium">
              <Printer className="w-4 h-4" />
              <span className="hidden md:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Order Status */}
        <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Order Status</h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                Track your order progress
              </p>
            </div>
          </div>

          <StatusTimeline steps={mockOrder.timeline} />
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-sm">
          <h4 className="font-semibold text-lg mb-6">Order Items</h4>

          <div className="space-y-6">
            {mockOrder.items.map((item) => (
              <div key={item.id} className="flex gap-4">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover"
                />

                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold mb-2">{item.name}</h5>

                  {/* Customization Details */}
                  {item.customization && (
                    <div className="space-y-1 mb-2">
                      {item.customization.text && (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          <span className="font-medium">Text:</span>{" "}
                          {item.customization.text}
                        </p>
                      )}
                      {item.customization.photo && (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          <span className="font-medium">Photo:</span>{" "}
                          {item.customization.photo}
                        </p>
                      )}
                      {item.customization.style && (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          <span className="font-medium">Style:</span>{" "}
                          {item.customization.style}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Qty: {item.quantity}
                    </p>
                    <p className="font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--color-border)] my-6" />

          {/* Order Summary */}
          <div className="space-y-2 text-sm max-w-md ml-auto">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Subtotal</span>
              <span>${mockOrder.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">
                Shipping (Express)
              </span>
              <span>${mockOrder.shipping.toFixed(2)}</span>
            </div>
            {mockOrder.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Discount</span>
                <span className="text-[var(--color-success)]">
                  -${mockOrder.discount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="border-t border-[var(--color-border)] my-3" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span className="text-xl">${mockOrder.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping & Payment Info */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h4 className="font-semibold text-lg mb-4">Shipping Address</h4>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {mockOrder.shippingAddress.name}
              <br />
              {mockOrder.shippingAddress.line1}
              <br />
              {mockOrder.shippingAddress.line2}
              <br />
              {mockOrder.shippingAddress.phone}
            </p>
          </div>

          {/* Payment & Billing */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h4 className="font-semibold text-lg mb-4">Payment Method</h4>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {mockOrder.paymentMethod}
            </p>

            <h5 className="font-semibold mb-2">Billing Address</h5>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {mockOrder.billingAddress.name}
              <br />
              {mockOrder.billingAddress.line1}
              <br />
              {mockOrder.billingAddress.line2}
            </p>
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Need help with this order?
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            <a
              href="mailto:support@macorner.co"
              className="text-[var(--color-primary)] hover:underline font-semibold"
            >
              Email Support
            </a>
            <span className="hidden md:inline text-[var(--color-text-muted)]">
              •
            </span>
            <button className="text-[var(--color-primary)] hover:underline font-semibold">
              Start Live Chat
            </button>
            <span className="hidden md:inline text-[var(--color-text-muted)]">
              •
            </span>
            <button className="text-[var(--color-error)] hover:underline font-semibold">
              Request Cancellation
            </button>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
