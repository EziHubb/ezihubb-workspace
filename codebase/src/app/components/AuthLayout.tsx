import { X } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export function AuthLayout({ children, showCloseButton = true }: AuthLayoutProps) {
  const testimonials = [
    {
      quote: "The best gift I've ever given! My mom cried when she saw the personalized photo book.",
      author: "Jessica M.",
    },
    {
      quote: "Fast shipping and amazing quality. The custom mug turned out even better than I imagined!",
      author: "David K.",
    },
    {
      quote: "I order from Macorner for every special occasion. Never disappoints!",
      author: "Amanda R.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[var(--color-border)] h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg font-['Playfair_Display']">
              M
            </span>
          </div>
          <span className="font-['Playfair_Display'] font-bold text-lg text-[var(--color-secondary)]">
            Macorner
          </span>
        </div>
        {showCloseButton && (
          <a
            href="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </a>
        )}
      </div>

      {/* Desktop Split Layout */}
      <div className="hidden md:flex min-h-screen">
        {/* Left Panel - Brand */}
        <div className="w-[40%] bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-12 flex flex-col relative overflow-hidden">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-[var(--color-primary)] font-bold text-2xl font-['Playfair_Display']">
                M
              </span>
            </div>
            <span className="font-['Playfair_Display'] font-bold text-2xl">
              Macorner
            </span>
          </div>

          {/* Tagline */}
          <h2 className="font-['Playfair_Display'] font-bold text-3xl mb-auto">
            Gifts Made Personal,
            <br />
            Moments Made Memorable
          </h2>

          {/* Testimonials */}
          <div className="space-y-6 mb-24">
            {testimonials.map((testimonial, index) => (
              <div key={index}>
                <div className="flex gap-0.5 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-300 text-lg">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-white/90 italic text-sm mb-1">
                  "{testimonial.quote}"
                </p>
                <p className="text-white/70 text-xs">— {testimonial.author}</p>
              </div>
            ))}
          </div>

          {/* Decorative Product Images */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-4 px-12 pb-8">
            <img
              src="https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200"
              alt="Product"
              className="w-32 h-32 rounded-lg object-cover shadow-xl transform -rotate-6"
            />
            <img
              src="https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200"
              alt="Product"
              className="w-32 h-32 rounded-lg object-cover shadow-xl transform rotate-3 translate-y-4"
            />
            <img
              src="https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=200"
              alt="Product"
              className="w-32 h-32 rounded-lg object-cover shadow-xl transform -rotate-3"
            />
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="w-[60%] flex items-center justify-center p-8">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden pt-14">
        {/* Top Brand Strip */}
        <div className="bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-primary-dark)] h-[120px] flex flex-col items-center justify-center text-white px-6">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-3">
            <span className="text-[var(--color-primary)] font-bold text-2xl font-['Playfair_Display']">
              M
            </span>
          </div>
          <p className="text-sm text-center text-white/90">
            Personalized Gifts Made With Love
          </p>
        </div>

        {/* Form Area */}
        <div className="bg-white rounded-t-[20px] -mt-4 px-6 pt-8 pb-24 min-h-[calc(100vh-120px-56px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
