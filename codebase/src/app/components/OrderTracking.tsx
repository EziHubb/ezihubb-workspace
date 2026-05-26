import { useState } from "react";
import { Navbar } from "./Navbar";
import { StatusTimeline } from "./StatusTimeline";

interface OrderItem {
  id: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

const mockOrderData = {
  orderNumber: "MC-2024-04521",
  placedDate: "June 1, 2024",
  status: "Shipped",
  items: [
    {
      id: 1,
      name: "Custom Name & Photo Coffee Mug",
      image:
        "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200",
      price: 27.99,
      quantity: 2,
    },
    {
      id: 2,
      name: "Personalized Canvas Print",
      image:
        "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200",
      price: 49.99,
      quantity: 1,
    },
  ],
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

export function OrderTracking() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [orderFound, setOrderFound] = useState(false);
  const [orderData, setOrderData] = useState(mockOrderData);

  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would make an API call
    // For now, just show the mock data
    setOrderFound(true);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "shipped":
        return "bg-[var(--color-primary)]/10 text-[var(--color-primary)]";
      case "delivered":
        return "bg-[var(--color-success)]/10 text-[var(--color-success)]";
      case "in production":
        return "bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
      default:
        return "bg-gray-100 text-[var(--color-text-muted)]";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navbar />

      <main className="pt-16 md:pt-20 pb-20 md:pb-8">
        <div className="max-w-[560px] mx-auto px-4 md:px-8 py-8 md:py-16">
          {/* Page Header */}
          <h2 className="font-['Playfair_Display'] font-bold text-3xl md:text-4xl text-[var(--color-secondary)] mb-3">
            Track Your Order
          </h2>
          <p className="text-[var(--color-text-muted)] mb-8">
            Enter your order number and email address to see your order status.
          </p>

          {/* Search Form */}
          {!orderFound && (
            <form
              onSubmit={handleTrackOrder}
              className="bg-white rounded-2xl md:rounded-xl p-6 md:p-8 shadow-md"
            >
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Order Number <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. MC-2024-04521"
                  required
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Email Address <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email used at checkout"
                  required
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-4 rounded-lg transition-colors uppercase tracking-wide"
              >
                Track Order
              </button>
            </form>
          )}

          {/* Order Found State */}
          {orderFound && (
            <div className="space-y-6">
              {/* Result Card */}
              <div className="bg-white rounded-2xl md:rounded-xl p-6 md:p-8 shadow-md">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
                  <h4 className="font-semibold text-xl">
                    Order #{orderData.orderNumber}
                  </h4>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-[var(--radius-pill)] text-sm font-semibold ${getStatusBadgeColor(
                      orderData.status
                    )}`}
                  >
                    {orderData.status}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-6">
                  Placed: {orderData.placedDate}
                </p>

                {/* Status Timeline */}
                <div className="mb-6">
                  <StatusTimeline steps={orderData.timeline} />
                </div>

                {/* Divider */}
                <div className="border-t border-[var(--color-border)] my-6" />

                {/* Items in Order */}
                <div>
                  <h5 className="font-semibold text-base mb-4">
                    Items in this order
                  </h5>
                  <div className="space-y-3">
                    {orderData.items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">
                            {item.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-medium shrink-0">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Track Another Order Button */}
              <button
                onClick={() => {
                  setOrderFound(false);
                  setOrderNumber("");
                  setEmail("");
                }}
                className="w-full border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] font-semibold py-3 rounded-lg transition-colors uppercase tracking-wide"
              >
                Track Another Order
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
