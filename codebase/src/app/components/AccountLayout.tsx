import { useState } from "react";
import { User, Package, Heart, MapPin, Settings, Menu, X } from "lucide-react";
import { Navbar } from "./Navbar";

interface AccountLayoutProps {
  children: React.ReactNode;
  activePage: "orders" | "order-detail" | "wishlist" | "addresses" | "settings";
}

export function AccountLayout({ children, activePage }: AccountLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "orders" as const, label: "My Orders", icon: Package },
    { id: "wishlist" as const, label: "Wishlist", icon: Heart },
    { id: "addresses" as const, label: "Address Book", icon: MapPin },
    { id: "settings" as const, label: "Profile Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Navbar />

      <main className="pt-16 md:pt-20 pb-20 md:pb-8">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 md:py-12">
          {/* Page Header */}
          <div className="mb-6 md:mb-8 flex items-center justify-between">
            <div>
              <h2 className="font-['Playfair_Display'] font-bold text-3xl md:text-4xl text-[var(--color-secondary)] mb-2">
                My Account
              </h2>
              <p className="text-[var(--color-text-muted)]">
                Welcome back, Sarah Johnson
              </p>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-white rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:block w-64 shrink-0">
              <nav className="bg-white rounded-xl p-4 shadow-sm sticky top-24">
                <div className="flex items-center gap-3 p-3 mb-4 border-b border-[var(--color-border)]">
                  <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">Sarah Johnson</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      sarah.j@email.com
                    </p>
                  </div>
                </div>

                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      activePage === item.id ||
                      (activePage === "order-detail" && item.id === "orders");
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                            isActive
                              ? "bg-[var(--color-primary)] text-white font-semibold"
                              : "text-[var(--color-secondary)] hover:bg-gray-50"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <button className="w-full text-left px-3 py-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-50 rounded-lg transition-colors text-sm">
                    Sign Out
                  </button>
                </div>
              </nav>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
              <>
                <div
                  className="md:hidden fixed inset-0 bg-black/40 z-40"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <aside className="md:hidden fixed top-0 left-0 bottom-0 w-80 bg-white z-50 shadow-xl overflow-y-auto">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg">Menu</h3>
                      <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 mb-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">Sarah Johnson</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">
                          sarah.j@email.com
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-1">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          activePage === item.id ||
                          (activePage === "order-detail" && item.id === "orders");
                        return (
                          <li key={item.id}>
                            <a
                              href={`#${item.id}`}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                                isActive
                                  ? "bg-[var(--color-primary)] text-white font-semibold"
                                  : "text-[var(--color-secondary)] hover:bg-gray-50"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                              <span>{item.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                      <button className="w-full text-left px-3 py-3 text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-50 rounded-lg transition-colors">
                        Sign Out
                      </button>
                    </div>
                  </div>
                </aside>
              </>
            )}

            {/* Main Content */}
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
