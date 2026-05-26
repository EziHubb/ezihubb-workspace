import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    // Simulate invalid credentials for demo
    if (email !== "demo@macorner.co" || password !== "demo123") {
      setError("Invalid email or password");
      return;
    }

    console.log("Login successful");
  };

  return (
    <AuthLayout>
      <div>
        <h2 className="font-['Playfair_Display'] font-bold text-3xl md:text-4xl text-[var(--color-secondary)] mb-3">
          Welcome Back
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Sign in to access your orders, wishlist and saved gifts.
        </p>

        {/* Google Sign In */}
        <button className="w-full flex items-center justify-center gap-3 px-6 py-3 md:py-3.5 border-2 border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors font-semibold bg-white">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 border-t border-[var(--color-border)]" />
          <span className="text-xs text-[var(--color-text-muted)] uppercase">
            or sign in with email
          </span>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm animate-shake">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full px-4 py-3 md:py-3.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                error
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                  : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
              }`}
            />
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full px-4 py-3 md:py-3.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                    : "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-secondary)]"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between mb-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <span className="text-sm">Remember me</span>
            </label>
            <a
              href="#forgot-password"
              className="text-sm text-[var(--color-primary)] hover:underline font-semibold"
            >
              Forgot password?
            </a>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3 md:py-4 rounded-lg transition-colors uppercase tracking-wide"
          >
            Sign In
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center border-t border-[var(--color-border)] pt-6">
          <p className="text-sm text-[var(--color-text-muted)]">
            New to Macorner?{" "}
            <a
              href="#register"
              className="text-[var(--color-primary)] hover:underline font-semibold"
            >
              Create an account →
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
