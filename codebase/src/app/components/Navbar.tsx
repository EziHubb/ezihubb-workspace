import { useState, useEffect } from "react";
import { Search, Heart, ShoppingBag, Menu, X, Home, User } from "lucide-react";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartCount] = useState(3);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Desktop & Mobile Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 ${
          isScrolled ? "shadow-[var(--shadow-floating)]" : ""
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Left: Logo & Hamburger */}
            <div className="flex items-center gap-4">
              {/* Mobile Hamburger */}
              <button
                className="md:hidden p-2 -ml-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>

              {/* Logo */}
              <a href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl md:text-2xl font-['Playfair_Display']">
                    M
                  </span>
                </div>
                <span className="font-['Playfair_Display'] font-bold text-xl md:text-2xl text-[var(--color-secondary)]">
                  Macorner
                </span>
              </a>
            </div>

            {/* Center: Nav Links (Desktop Only) */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#shop"
                className="text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Shop All
              </a>
              <a
                href="#collections"
                className="text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Collections
              </a>
              <a
                href="#occasions"
                className="text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Occasions
              </a>
              <a
                href="#gift-cards"
                className="text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Gift Cards
              </a>
            </div>

            {/* Right: Icons & Login */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* Search Icon */}
              <button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5 text-[var(--color-secondary)]" />
              </button>

              {/* Wishlist Icon (Desktop Only) */}
              <button
                className="hidden md:block p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5 text-[var(--color-secondary)]" />
              </button>

              {/* Cart Icon with Badge */}
              <button
                className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
                aria-label="Shopping cart"
              >
                <ShoppingBag className="w-5 h-5 text-[var(--color-secondary)]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[var(--color-primary)] text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Login Button (Desktop Only) */}
              <button className="hidden md:block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-sm px-6 py-2 rounded-[var(--radius-button)] transition-colors uppercase tracking-wide">
                Login
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--color-border)] bg-white">
            <div className="px-4 py-4 space-y-3">
              <a
                href="#shop"
                className="block py-2 text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Shop All
              </a>
              <a
                href="#collections"
                className="block py-2 text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Collections
              </a>
              <a
                href="#occasions"
                className="block py-2 text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Occasions
              </a>
              <a
                href="#gift-cards"
                className="block py-2 text-sm font-medium text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                Gift Cards
              </a>
              <button className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-sm py-3 rounded-[var(--radius-button)] transition-colors uppercase tracking-wide">
                Login
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-border)] shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around h-16">
          <button className="flex flex-col items-center gap-1 p-2 text-[var(--color-primary)]">
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <Search className="w-5 h-5" />
            <span className="text-xs font-medium">Search</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-1 bg-[var(--color-primary)] text-white text-xs font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
            <span className="text-xs font-medium">Cart</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <User className="w-5 h-5" />
            <span className="text-xs font-medium">Account</span>
          </button>
        </div>
      </div>
    </>
  );
}
