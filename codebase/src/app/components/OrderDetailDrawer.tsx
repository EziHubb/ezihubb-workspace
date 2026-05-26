import { useState } from "react";
import { X, Eye, DollarSign, Mail } from "lucide-react";

interface OrderDetailDrawerProps {
  orderNumber: string;
  onClose: () => void;
}

export function OrderDetailDrawer({ orderNumber, onClose }: OrderDetailDrawerProps) {
  const [carrier, setCarrier] = useState("FedEx");
  const [trackingNumber, setTrackingNumber] = useState("794644792798");
  const [orderStatus, setOrderStatus] = useState("Shipped");
  const [statusNote, setStatusNote] = useState("");

  const orderData = {
    orderNumber: "MC-04521",
    customer: {
      name: "Sarah Johnson",
      email: "sarah@email.com",
      phone: "+1 555 0100",
    },
    date: "Jun 3, 2024",
    total: 55.98,
    status: "Shipped",
    items: [
      {
        id: 1,
        name: "Custom Name & Photo Coffee Mug",
        image: "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200",
        quantity: 2,
        price: 27.99,
        customization: {
          names: "John & Sarah",
          style: "Watercolor",
        },
      },
    ],
    shippingAddress: {
      name: "Sarah Johnson",
      line1: "123 Main Street, Apt 4B",
      line2: "San Francisco, CA 94102",
    },
    timeline: [
      {
        status: "completed",
        label: "Confirmed",
        date: "Jun 1, 2:14 PM",
      },
      {
        status: "completed",
        label: "In Production",
        date: "Jun 2, 9:00 AM",
      },
      {
        status: "current",
        label: "Shipped",
        date: "Jun 3, 11:32 AM",
      },
      {
        status: "upcoming",
        label: "Delivered",
        date: "Est. Jun 5–10",
      },
      {
        status: "upcoming",
        label: "Completed",
        date: "",
      },
    ],
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h4 className="font-semibold text-xl">
                  Order #{orderData.orderNumber}
                </h4>
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {orderData.status}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {orderData.customer.name} · {orderData.date} · ${orderData.total.toFixed(2)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Timeline */}
          <div>
            <h5 className="font-semibold text-base mb-4">Order Timeline</h5>
            <div className="relative pl-8">
              {/* Vertical Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              {orderData.timeline.map((step, index) => (
                <div key={index} className="relative pb-6 last:pb-0">
                  {/* Circle */}
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      step.status === "completed"
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                        : step.status === "current"
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/20 animate-pulse"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    {step.status === "completed" && (
                      <span className="text-white text-sm">✓</span>
                    )}
                    {step.status === "current" && (
                      <div className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="ml-4">
                    <p
                      className={`font-semibold text-sm ${
                        step.status === "current"
                          ? "text-[var(--color-primary)]"
                          : step.status === "completed"
                          ? "text-[var(--color-secondary)]"
                          : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {step.date}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="pt-6 border-t border-[var(--color-border)]">
            <h5 className="font-semibold text-base mb-4">
              Items ({orderData.items.length})
            </h5>
            <div className="space-y-4">
              {orderData.items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-1">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">
                      Customization: Names: {item.customization.names} · Style:{" "}
                      {item.customization.style}
                    </p>
                    <button className="text-xs text-[var(--color-primary)] hover:underline font-medium flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      View customization
                    </button>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Qty {item.quantity}
                      </p>
                      <p className="font-semibold text-sm">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer */}
          <div className="pt-6 border-t border-[var(--color-border)]">
            <h5 className="font-semibold text-base mb-3">Customer</h5>
            <div className="space-y-2">
              <p className="text-sm font-medium">{orderData.customer.name}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {orderData.customer.email}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {orderData.customer.phone}
              </p>
            </div>
            <a
              href="#customer-profile"
              className="text-sm text-[var(--color-primary)] hover:underline font-semibold mt-3 inline-block"
            >
              View Customer Profile →
            </a>
          </div>

          {/* Shipping */}
          <div className="pt-6 border-t border-[var(--color-border)]">
            <h5 className="font-semibold text-base mb-3">Shipping</h5>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
              {orderData.shippingAddress.name}
              <br />
              {orderData.shippingAddress.line1}
              <br />
              {orderData.shippingAddress.line2}
            </p>

            <p className="text-sm font-medium mb-4">
              Method: Express Shipping — FedEx
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">
                Tracking Number
              </label>
              <div className="flex gap-2 mb-2">
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="px-3 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm"
                >
                  <option>FedEx</option>
                  <option>UPS</option>
                  <option>USPS</option>
                  <option>DHL</option>
                </select>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm font-mono"
                />
              </div>
              <button className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg transition-colors text-sm font-semibold uppercase tracking-wide">
                Save
              </button>
            </div>
          </div>

          {/* Update Status */}
          <div className="pt-6 border-t border-[var(--color-border)]">
            <h5 className="font-semibold text-base mb-3">Update Order Status</h5>
            <div className="space-y-3">
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm"
              >
                <option>Pending</option>
                <option>In Production</option>
                <option>Shipped</option>
                <option>Delivered</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>

              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Add note (optional)"
                rows={3}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm resize-none"
              />

              <button className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3 rounded-lg transition-colors uppercase tracking-wide">
                Update Status
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--color-border)] bg-gray-50 shrink-0">
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-semibold uppercase tracking-wide">
              <DollarSign className="w-4 h-4" />
              Issue Refund
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] rounded-lg transition-colors text-sm font-semibold uppercase tracking-wide">
              <Mail className="w-4 h-4" />
              Email Customer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
