import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[var(--color-secondary)] text-white">
      {/* Main Footer Content */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* About Macorner */}
          <div>
            <h4 className="font-semibold text-lg mb-4">About Macorner</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#our-story"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Our Story
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#reviews"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Reviews
                </a>
              </li>
              <li>
                <a
                  href="#careers"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Careers
                </a>
              </li>
            </ul>
          </div>

          {/* Help & Support */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Help & Support</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#contact"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="#shipping"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Shipping Info
                </a>
              </li>
              <li>
                <a
                  href="#returns"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Returns & Exchanges
                </a>
              </li>
            </ul>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Shop</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#all-products"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  All Products
                </a>
              </li>
              <li>
                <a
                  href="#collections"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Collections
                </a>
              </li>
              <li>
                <a
                  href="#occasions"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Occasions
                </a>
              </li>
              <li>
                <a
                  href="#gift-cards"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Gift Cards
                </a>
              </li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="font-semibold text-lg mb-4">Follow Us</h4>
            <p className="text-sm text-gray-300 mb-4">
              Join our community for inspiration, exclusive offers, and more.
            </p>
            <div className="flex gap-3">
              <a
                href="#facebook"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--color-primary)] flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#instagram"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--color-primary)] flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#twitter"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--color-primary)] flex items-center justify-center transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#youtube"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--color-primary)] flex items-center justify-center transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
            <p>© 2024 Macorner. All rights reserved.</p>
            <div className="flex gap-6">
              <a
                href="#privacy"
                className="hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
              <a href="#terms" className="hover:text-white transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
