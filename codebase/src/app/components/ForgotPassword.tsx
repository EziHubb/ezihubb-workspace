import { useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
    }
  };

  const handleResend = () => {
    console.log("Resending email to:", email);
  };

  if (isSubmitted) {
    return (
      <AuthLayout>
        <div className="text-center">
          {/* Success Icon */}
          <div className="mx-auto w-20 h-20 md:w-24 md:h-24 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-10 h-10 md:w-12 md:h-12 text-[var(--color-primary)]" />
          </div>

          <h3 className="font-['Playfair_Display'] font-bold text-2xl md:text-3xl text-[var(--color-secondary)] mb-3">
            Check your inbox!
          </h3>

          <p className="text-[var(--color-text-muted)] mb-8 max-w-md mx-auto">
            We sent a reset link to{" "}
            <span className="font-semibold text-[var(--color-secondary)]">
              {email}
            </span>
            . Link expires in 1 hour.
          </p>

          {/* Back to Sign In Button */}
          <a
            href="#login"
            className="inline-flex items-center justify-center gap-2 w-full border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] font-semibold py-3 md:py-4 rounded-lg transition-colors uppercase tracking-wide mb-3"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Sign In
          </a>

          {/* Resend Link */}
          <p className="text-sm text-[var(--color-text-muted)]">
            Didn't receive it?{" "}
            <button
              onClick={handleResend}
              className="text-[var(--color-primary)] hover:underline font-semibold"
            >
              Resend
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div>
        {/* Back Link */}
        <a
          href="#login"
          className="inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline font-semibold mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Sign In
        </a>

        <h2 className="font-['Playfair_Display'] font-bold text-3xl md:text-4xl text-[var(--color-secondary)] mb-3">
          Reset Password
        </h2>

        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Enter your email and we'll send you a reset link. Check your spam
          folder too.
        </p>

        {/* Reset Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 md:py-3.5 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
            />
          </div>

          {/* Send Reset Link Button */}
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3 md:py-4 rounded-lg transition-colors uppercase tracking-wide"
          >
            Send Reset Link
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-secondary)]">
              Having trouble?
            </span>{" "}
            Make sure you're using the email address associated with your
            account. Still stuck?{" "}
            <a
              href="mailto:support@macorner.co"
              className="text-[var(--color-primary)] hover:underline font-semibold"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
