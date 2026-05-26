import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FolderOpen,
  Users,
  Tag,
  Star,
  Truck,
  CreditCard,
  Settings,
  LogOut
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  activePage: "dashboard" | "orders" | "products" | "catalog" | "customers" | "promotions" | "reviews" | "shipping" | "payments" | "settings";
  pageTitle: string;
  pageSubtitle?: string;
  topbarActions?: React.ReactNode;
}

export function AdminLayout({
  children,
  activePage,
  pageTitle,
  pageSubtitle,
  topbarActions
}: AdminLayoutProps) {
  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "orders" as const, label: "Orders", icon: Package, badge: 12 },
    { id: "products" as const, label: "Products", icon: ShoppingBag },
    { id: "catalog" as const, label: "Catalog", icon: FolderOpen },
    { id: "customers" as const, label: "Customers", icon: Users },
    { id: "promotions" as const, label: "Promotions", icon: Tag },
    { id: "reviews" as const, label: "Reviews", icon: Star, badge: 5 },
    { id: "shipping" as const, label: "Shipping", icon: Truck },
    { id: "payments" as const, label: "Payments", icon: CreditCard },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Fixed Left Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-[#1E1E2E] text-white flex flex-col">
        {/* Logo */}
        <div className="p-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--color-primary)] rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm font-['Playfair_Display']">
                M
              </span>
            </div>
            <span className="font-['Playfair_Display'] font-bold text-lg">
              Macorner
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">Admin</p>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <a
                key={item.id}
                href={`#admin-${item.id}`}
                className={`flex items-center gap-3 h-11 px-4 mx-2 mb-1 rounded-lg transition-all relative ${
                  isActive
                    ? "bg-[var(--color-primary)]/15 text-white"
                    : "text-[#9CA3AF] hover:bg-white/5 hover:text-white"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--color-primary)] rounded-r" />
                )}
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? "text-[var(--color-primary)]" : ""
                  }`}
                />
                <span className="text-sm font-medium">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-[var(--color-primary)] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">AU</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                Admin User
              </p>
              <p className="text-xs text-[#9CA3AF] truncate">
                admin@macorner.co
              </p>
            </div>
          </div>
          <a
            href="#logout"
            className="flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-white transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Log Out
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="ml-60">
        {/* Top Bar */}
        <header className="fixed left-60 right-0 top-0 h-16 bg-white border-b border-[var(--color-border)] flex items-center justify-between px-8 z-10">
          <div>
            <h1 className="font-semibold text-2xl text-[var(--color-secondary)]">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                {pageSubtitle}
              </p>
            )}
          </div>

          {topbarActions && (
            <div className="flex items-center gap-4">
              {topbarActions}
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="pt-16 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
