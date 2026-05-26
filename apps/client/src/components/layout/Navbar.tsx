'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Heart, ShoppingBag, Menu, X, Home, User } from 'lucide-react';

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cartCount = 0;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: `/${locale}/products`, label: t('shopAll') },
    { href: `/${locale}/collections`, label: t('collections') },
    { href: `/${locale}/occasions`, label: t('occasions') },
    { href: `/${locale}/gift-cards`, label: t('giftCards') },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 bg-surface transition-shadow duration-300 ${
          isScrolled ? 'shadow-floating' : ''
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo & Hamburger */}
            <div className="flex items-center gap-4">
              <button
                className="md:hidden min-h-11 min-w-11 flex items-center justify-center -ml-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={t('toggleMenu')}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>

              <Link href={`/${locale}`} className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl md:text-2xl font-display">
                    M
                  </span>
                </div>
                <span className="font-display font-bold text-xl md:text-2xl text-secondary">
                  Macorner
                </span>
              </Link>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-secondary hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              <Link
                href={`/${locale}/search`}
                className="min-h-11 min-w-11 flex items-center justify-center hover:bg-muted rounded-full transition-colors"
                aria-label={t('search')}
              >
                <Search className="w-5 h-5 text-secondary" />
              </Link>

              <Link
                href={`/${locale}/wishlist`}
                className="hidden md:flex p-2 hover:bg-muted rounded-full transition-colors"
                aria-label={t('wishlist')}
              >
                <Heart className="w-5 h-5 text-secondary" />
              </Link>

              <Link
                href={`/${locale}/cart`}
                className="p-2 hover:bg-muted rounded-full transition-colors relative"
                aria-label={t('cart')}
              >
                <ShoppingBag className="w-5 h-5 text-secondary" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>

              <Link
                href={`/${locale}/login`}
                className="hidden md:block bg-primary hover:bg-primary-dark text-white font-semibold text-sm px-6 py-2 rounded-button transition-colors uppercase tracking-wide"
              >
                {t('login')}
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={`/${locale}/login`}
                className="block w-full bg-primary hover:bg-primary-dark text-white font-semibold text-sm py-3 rounded-button transition-colors uppercase tracking-wide text-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('login')}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around h-16">
          <Link
            href={`/${locale}`}
            className="flex flex-col items-center gap-1 min-w-11 min-h-11 justify-center text-primary"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">{t('home')}</span>
          </Link>
          <Link
            href={`/${locale}/search`}
            className="flex flex-col items-center gap-1 min-w-11 min-h-11 justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <Search className="w-5 h-5" />
            <span className="text-xs font-medium">{t('search')}</span>
          </Link>
          <Link
            href={`/${locale}/cart`}
            className="flex flex-col items-center gap-1 min-w-11 min-h-11 justify-center text-muted-foreground hover:text-primary transition-colors relative"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-1 bg-primary text-white text-xs font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
            <span className="text-xs font-medium">{t('cart')}</span>
          </Link>
          <Link
            href={`/${locale}/account`}
            className="flex flex-col items-center gap-1 min-w-11 min-h-11 justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-xs font-medium">{t('account')}</span>
          </Link>
        </div>
      </div>
    </>
  );
}
