import { Search, ChevronRight } from "lucide-react";
import { useState } from "react";
import { AccountLayout } from "./AccountLayout";

interface OrderItem {
  id: number;
  name: string;
  image: string;
  quantity: number;
}

interface Order {
  orderNumber: string;
  date: string;
  status: "Delivered" | "Shipped" | "In Production" | "Cancelled";
  total: number;
  items: OrderItem[];
  itemCount: number;
}

const mockOrders: Order[] = [
  {
    orderNumber: "MC-2024-04521",
    date: "June 1, 2024",
    status: "Shipped",
    total: 123.97,
    itemCount: 3,
    items: [
      {
        id: 1,
        name: "Custom Name & Photo Coffee Mug",
        image: "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200",
        quantity: 2,
      },
      {
        id: 2,
        name: "Personalized Canvas Print",
        image: "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200",
        quantity: 1,
      },
    ],
  },
  {
    orderNumber: "MC-2024-04412",
    date: "May 15, 2024",
    status: "Delivered",
    total: 89.98,
    itemCount: 2,
    items: [
      {
        id: 1,
        name: "Monogram Tumbler",
        image: "https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=200",
        quantity: 1,
      },
      {
        id: 2,
        name: "Engraved Wooden Box",
        image: "https://images.unsplash.com/photo-1585847935950-36dcf94bf5ea?w=200",
        quantity: 1,
      },
    ],
  },
  {
    orderNumber: "MC-2024-04289",
    date: "April 28, 2024",
    status: "Delivered",
    total: 67.99,
    itemCount: 1,
    items: [
      {
        id: 1,
        name: "Custom Photo Calendar 2024",
        image: "https://images.unsplash.com/photo-1506784871800-d8d48e5ea3d0?w=200",
        quantity: 1,
      },
    ],
  },
  {
    orderNumber: "MC-2024-03891",
    date: "March 10, 2024",
    status: "Cancelled",
    total: 45.0,
    itemCount: 1,
    items: [
      {
        id: 1,
        name: "Personalized Phone Case",
        image: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=200",
        quantity: 1,
      },
    ],
  },
];

export function MyOrders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "Delivered":
        return "bg-[var(--color-success)]/10 text-[var(--color-success)]";
      case "Shipped":
        return "bg-[var(--color-primary)]/10 text-[var(--color-primary)]";
      case "In Production":
        return "bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
      case "Cancelled":
        return "bg-gray-100 text-[var(--color-text-muted)]";
      default:
        return "bg-gray-100 text-[var(--color-text-muted)]";
    }
  };

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesStatus =
      filterStatus === "all" || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <AccountLayout activePage="orders">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-2xl mb-2">My Orders</h3>
          <p className="text-[var(--color-text-muted)]">
            Track, manage, and view your order history
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order number or product name"
              className="w-full pl-10 pr-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all bg-white"
          >
            <option value="all">All Orders</option>
            <option value="Delivered">Delivered</option>
            <option value="Shipped">Shipped</option>
            <option value="In Production">In Production</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm">
              <p className="text-[var(--color-text-muted)] mb-4">
                No orders found matching your search
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                }}
                className="text-[var(--color-primary)] hover:underline font-semibold"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.orderNumber}
                className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Order Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-[var(--color-border)]">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <h4 className="font-semibold text-lg">
                      Order #{order.orderNumber}
                    </h4>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-[var(--radius-pill)] text-sm font-semibold w-fit ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Placed: {order.date}
                  </p>
                </div>

                {/* Order Items */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Product Thumbnails */}
                  <div className="flex items-center gap-2">
                    {order.items.slice(0, 3).map((item, index) => (
                      <img
                        key={index}
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-lg object-cover"
                      />
                    ))}
                    {order.itemCount > 3 && (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-semibold text-[var(--color-text-muted)]">
                        +{order.itemCount - 3}
                      </div>
                    )}
                  </div>

                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-muted)] mb-1">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </p>
                    <p className="font-semibold text-lg">
                      ${order.total.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                  <a
                    href="#order-detail"
                    className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3 px-4 rounded-lg transition-colors text-center uppercase tracking-wide flex items-center justify-center gap-2"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </a>

                  {order.status === "Shipped" && (
                    <a
                      href="/track-order"
                      className="flex-1 border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] font-semibold py-3 px-4 rounded-lg transition-colors text-center uppercase tracking-wide"
                    >
                      Track Order
                    </a>
                  )}

                  {order.status === "Delivered" && (
                    <button className="flex-1 border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] font-semibold py-3 px-4 rounded-lg transition-colors uppercase tracking-wide">
                      Buy Again
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination placeholder */}
        {filteredOrders.length > 0 && (
          <div className="flex justify-center pt-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Showing {filteredOrders.length} of {mockOrders.length} orders
            </p>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
