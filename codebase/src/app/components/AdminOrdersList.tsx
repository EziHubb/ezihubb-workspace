import { useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { OrderDetailDrawer } from "./OrderDetailDrawer";
import { Search, Download, Eye, Edit, X } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
  };
  items: number;
  date: string;
  status: "Shipped" | "In Production" | "Completed" | "Cancelled" | "Delivered";
  total: number;
}

const mockOrders: Order[] = [
  {
    id: "1",
    orderNumber: "MC-04521",
    customer: { name: "Sarah Johnson", email: "sarah@email.com" },
    items: 2,
    date: "Jun 3",
    status: "Shipped",
    total: 55.98,
  },
  {
    id: "2",
    orderNumber: "MC-04520",
    customer: { name: "Mike Chen", email: "mike@email.com" },
    items: 1,
    date: "Jun 3",
    status: "In Production",
    total: 27.99,
  },
  {
    id: "3",
    orderNumber: "MC-04519",
    customer: { name: "Emma Wilson", email: "emma@email.com" },
    items: 3,
    date: "Jun 2",
    status: "Completed",
    total: 89.97,
  },
  {
    id: "4",
    orderNumber: "MC-04518",
    customer: { name: "James Park", email: "james@email.com" },
    items: 1,
    date: "Jun 2",
    status: "Cancelled",
    total: 24.99,
  },
  {
    id: "5",
    orderNumber: "MC-04517",
    customer: { name: "Lisa Chen", email: "lisa@email.com" },
    items: 2,
    date: "Jun 1",
    status: "Delivered",
    total: 67.98,
  },
];

export function AdminOrdersList() {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("This Month");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "Shipped":
        return "bg-blue-100 text-blue-700";
      case "In Production":
        return "bg-yellow-100 text-yellow-700";
      case "Completed":
        return "bg-green-100 text-green-700";
      case "Delivered":
        return "bg-green-100 text-green-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "Shipped":
        return "🔵";
      case "In Production":
        return "🟡";
      case "Completed":
      case "Delivered":
        return "✅";
      case "Cancelled":
        return "🔴";
      default:
        return "";
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAllOrders = () => {
    if (selectedOrders.length === mockOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(mockOrders.map((o) => o.id));
    }
  };

  const activeFilters = [];
  if (statusFilter !== "All") activeFilters.push({ type: "Status", value: statusFilter });
  if (dateFilter !== "This Month") activeFilters.push({ type: "Date", value: dateFilter });

  const topbarActions = (
    <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg transition-colors text-sm font-semibold uppercase tracking-wide">
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  );

  return (
    <>
      <AdminLayout
        activePage="orders"
        pageTitle="Orders"
        pageSubtitle="247 total orders"
        topbarActions={topbarActions}
      >
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-white text-sm"
              >
                <option>All</option>
                <option>Shipped</option>
                <option>In Production</option>
                <option>Completed</option>
                <option>Cancelled</option>
                <option>Delivered</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-white text-sm"
              >
                <option>This Month</option>
                <option>Last Month</option>
                <option>Last 3 Months</option>
                <option>This Year</option>
              </select>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order # or email"
                  className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm"
                />
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                {activeFilters.map((filter, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (filter.type === "Status") setStatusFilter("All");
                      if (filter.type === "Date") setDateFilter("This Month");
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-sm font-medium hover:bg-[var(--color-primary)]/20 transition-colors"
                  >
                    {filter.type}: {filter.value}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-[var(--color-border)]">
                  <tr>
                    <th className="w-10 px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === mockOrders.length}
                        onChange={toggleAllOrders}
                        className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {mockOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-sm">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-sm">
                            {order.customer.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {order.customer.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {order.items} {order.items === 1 ? "item" : "items"}
                      </td>
                      <td className="px-6 py-4 text-sm">{order.date}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            order.status
                          )}`}
                        >
                          <span>{getStatusIcon(order.status)}</span>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-sm">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(order.orderNumber)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {order.status !== "Cancelled" &&
                            order.status !== "Delivered" && (
                              <button
                                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bulk Action Bar */}
            {selectedOrders.length > 0 && (
              <div className="border-t-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-6 py-3 flex items-center gap-4">
                <span className="font-semibold text-sm">
                  {selectedOrders.length} selected
                </span>
                <button className="px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-white transition-colors text-sm font-medium">
                  Export selected
                </button>
                <button className="px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-white transition-colors text-sm font-medium">
                  Update status ▾
                </button>
              </div>
            )}

            {/* Pagination */}
            <div className="border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                Showing 1-20 of 247 orders
              </p>

              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-gray-50 transition-colors text-sm">
                  ← Prev
                </button>
                <button className="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-sm font-semibold">
                  1
                </button>
                <button className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-gray-50 transition-colors text-sm">
                  2
                </button>
                <button className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-gray-50 transition-colors text-sm">
                  3
                </button>
                <span className="px-2 text-[var(--color-text-muted)]">...</span>
                <button className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-gray-50 transition-colors text-sm">
                  13
                </button>
                <button className="px-3 py-1 border border-[var(--color-border)] rounded hover:bg-gray-50 transition-colors text-sm">
                  Next →
                </button>
              </div>

              <select className="px-3 py-1 border border-[var(--color-border)] rounded focus:border-[var(--color-primary)] focus:outline-none text-sm">
                <option>20</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
          </div>
        </div>
      </AdminLayout>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <OrderDetailDrawer
          orderNumber={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}
