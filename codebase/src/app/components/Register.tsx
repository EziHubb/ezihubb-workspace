import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

export function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    setPasswordStrength(strength);
  }, [password]);

  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 0:
        return "";
      case 1:
        return "Weak";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Strong";
      default:
        return "";
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 1:
        return "bg-red-500";
      case 2:
        return "bg-orange-500";
      case 3:
        return "bg-yellow-500";
      case 4:
        return "bg-green-500";
      default:
        return "bg-gray-200";
    }
  };

  const getStrengthTextColor = () => {
    switch (passwordStrength) {
      case 1:
        return "text-red-500";
      case 2:
        return "text-orange-500";
      case 3:
        return "text-yellow-600";
      case 4:
        return "text-green-500";
      default:
        return "text-[var(--color-text-muted)]";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreeToTerms) {
      alert("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    console.log("Registration successful");
  };

  return (
    <AuthLayout>
      <div>
        <h2 className="font-['Playfair_Display'] font-bold text-3xl md:text-4xl text-[var(--color-secondary)] mb-3">
          Create Your Account
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Join thousands of happy customers.
        </p>

        {/* Google Sign Up */}
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
            or sign up with email
          </span>
          <div className="flex-1 border-t border-[var(--color-border)]" />
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit}>
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
                className="w-full px-4 py-3 md:py-3.5 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                className="w-full px-4 py-3 md:py-3.5 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-3">
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

          {/* Password */}
          <div className="mb-2">
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                className="w-full px-4 py-3 md:py-3.5 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
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

          {/* Password Strength Bar */}
          {password && (
            <div className="mb-3">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((segment) => (
                  <div
                    key={segment}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      segment <= passwordStrength
                        ? getStrengthColor()
                        : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium ${getStrengthTextColor()}`}>
                {getStrengthLabel()}
              </p>
            </div>
          )}

          {/* Confirm Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                className="w-full px-4 py-3 md:py-3.5 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-secondary)]"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="mb-5">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <span className="text-sm text-[var(--color-text-muted)]">
                I agree to the{" "}
                <a
                  href="#terms"
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="#privacy"
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={!agreeToTerms}
            className={`w-full font-semibold py-3 md:py-4 rounded-lg transition-colors uppercase tracking-wide ${
              agreeToTerms
                ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
                : "bg-gray-200 text-[var(--color-text-muted)] cursor-not-allowed"
            }`}
          >
            Create Account
          </button>
        </form>

        {/* Sign In Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Already have an account?{" "}
            <a
              href="#login"
              className="text-[var(--color-primary)] hover:underline font-semibold"
            >
              Sign in →
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
