import { AdminLayout } from "./AdminLayout";
import { TrendingUp, TrendingDown, Download, ArrowUpDown, Check, EyeOff } from "lucide-react";

export function AdminDashboard() {
  const kpiCards = [
    {
      label: "Revenue Today",
      value: "$4,280",
      trend: "+12%",
      trendUp: true,
      icon: "💰",
    },
    {
      label: "Orders Today",
      value: "47",
      trend: "+8%",
      trendUp: true,
      icon: "📦",
    },
    {
      label: "Awaiting Action",
      value: "12",
      trend: null,
      color: "text-[var(--color-warning)]",
      icon: "⏳",
    },
    {
      label: "In Production",
      value: "28",
      trend: null,
      color: "text-blue-500",
      icon: "🔨",
    },
  ];

  const topProducts = [
    {
      rank: 1,
      name: "Custom Name & Photo Coffee Mug",
      image: "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=100",
      category: "Drinkware",
      unitsSold: 234,
      revenue: 5832,
      rating: 4.9,
    },
    {
      rank: 2,
      name: "Personalized Canvas Print",
      image: "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=100",
      category: "Wall Art",
      unitsSold: 187,
      revenue: 9349,
      rating: 4.8,
    },
    {
      rank: 3,
      name: "Monogram Tumbler",
      image: "https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=100",
      category: "Drinkware",
      unitsSold: 156,
      revenue: 4680,
      rating: 4.7,
    },
    {
      rank: 4,
      name: "Engraved Wooden Box",
      image: "https://images.unsplash.com/photo-1585847935950-36dcf94bf5ea?w=100",
      category: "Home & Living",
      unitsSold: 142,
      revenue: 5680,
      rating: 4.9,
    },
    {
      rank: 5,
      name: "Custom Photo Calendar",
      image: "https://images.unsplash.com/photo-1506784871800-d8d48e5ea3d0?w=100",
      category: "Stationery",
      unitsSold: 128,
      revenue: 3840,
      rating: 4.6,
    },
  ];

  const pendingReviews = [
    {
      stars: 5,
      customer: "Sarah Johnson",
      product: "Custom Name & Photo Coffee Mug",
      date: "2 hours ago",
    },
    {
      stars: 4,
      customer: "Mike Chen",
      product: "Personalized Canvas Print",
      date: "5 hours ago",
    },
    {
      stars: 5,
      customer: "Emma Wilson",
      product: "Monogram Tumbler",
      date: "1 day ago",
    },
    {
      stars: 5,
      customer: "James Park",
      product: "Engraved Wooden Box",
      date: "1 day ago",
    },
    {
      stars: 3,
      customer: "Lisa Chen",
      product: "Custom Photo Calendar",
      date: "2 days ago",
    },
  ];

  const ordersByStatus = [
    { status: "Completed", count: 145, percentage: 58, color: "#2E7D52" },
    { status: "Shipped", count: 52, percentage: 21, color: "#E85D3F" },
    { status: "In Production", count: 38, percentage: 15, color: "#3B82F6" },
    { status: "Pending", count: 15, percentage: 6, color: "#D97706" },
  ];

  const topbarActions = (
    <>
      <button className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
        Jun 1 – Jun 30
        <span className="text-[var(--color-text-muted)]">▾</span>
      </button>
      <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg transition-colors text-sm font-semibold uppercase tracking-wide">
        <Download className="w-4 h-4" />
        Export Report
      </button>
    </>
  );

  return (
    <AdminLayout
      activePage="dashboard"
      pageTitle="Dashboard"
      topbarActions={topbarActions}
    >
      <div className="space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-4 gap-6">
          {kpiCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h5 className="text-sm font-medium text-[var(--color-text-muted)]">
                  {card.label}
                </h5>
                {card.trend && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      card.trendUp
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {card.trendUp ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {card.trend}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p
                  className={`text-4xl font-bold ${
                    card.color || "text-[var(--color-secondary)]"
                  }`}
                >
                  {card.value}
                </p>
                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-xl">
                  {card.icon}
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                vs. last period
              </p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-[65%_35%] gap-6">
          {/* Line Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-semibold text-lg">Revenue — Last 30 Days</h4>
              <p className="text-2xl font-bold text-[var(--color-primary)]">
                $84,320
              </p>
            </div>

            {/* Simplified chart representation */}
            <div className="h-[400px] flex items-end gap-2">
              {[42, 58, 45, 72, 88, 65, 95, 78, 82, 69, 91, 76, 84, 92, 87, 94, 89, 96, 91, 88, 93, 97, 89, 91, 95, 92, 88, 94, 98, 100].map((height, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-primary)]/40 rounded-t" style={{ height: `${height}%` }} />
              ))}
            </div>

            <div className="flex justify-between mt-4 text-xs text-[var(--color-text-muted)]">
              <span>Jun 1</span>
              <span>Jun 15</span>
              <span>Jun 30</span>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h4 className="font-semibold text-lg mb-6">Orders by Status</h4>

            {/* Simplified donut chart */}
            <div className="relative w-60 h-60 mx-auto mb-6">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#2E7D52"
                  strokeWidth="20"
                  strokeDasharray="58 100"
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#E85D3F"
                  strokeWidth="20"
                  strokeDasharray="21 100"
                  strokeDashoffset="-58"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="20"
                  strokeDasharray="15 100"
                  strokeDashoffset="-79"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="20"
                  strokeDasharray="6 100"
                  strokeDashoffset="-94"
                />
              </svg>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {ordersByStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.status}</span>
                  </div>
                  <div className="text-sm font-medium">
                    {item.count} <span className="text-[var(--color-text-muted)]">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Tables Row */}
        <div className="grid grid-cols-[60%_40%] gap-6">
          {/* Top Products Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
              <h4 className="font-semibold text-lg">Best Selling Products</h4>
              <a
                href="#all-products"
                className="text-sm text-[var(--color-primary)] hover:underline font-semibold"
              >
                View All →
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      <button className="flex items-center gap-1 hover:text-[var(--color-secondary)]">
                        Product
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      <button className="flex items-center gap-1 hover:text-[var(--color-secondary)]">
                        Units Sold
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      <button className="flex items-center gap-1 hover:text-[var(--color-secondary)]">
                        Revenue
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {topProducts.map((product) => (
                    <tr key={product.rank} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-lg text-[var(--color-primary)]">
                          #{product.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                          <span className="font-medium text-sm">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {product.unitsSold}
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        ${product.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-sm font-semibold">
                          ⭐ {product.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Reviews */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
              <h4 className="font-semibold text-lg">Reviews to Approve</h4>
              <span className="bg-[var(--color-primary)] text-white px-2 py-1 rounded-full text-xs font-semibold">
                5 pending
              </span>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {pendingReviews.map((review, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < review.stars
                            ? "text-[var(--color-warning)]"
                            : "text-gray-200"
                        }
                      >
                        ★
                      </span>
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {review.customer}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {review.product}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {review.date}
                    </p>
                    <button className="p-1.5 hover:bg-green-100 rounded text-green-600 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded text-[var(--color-text-muted)] transition-colors">
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
