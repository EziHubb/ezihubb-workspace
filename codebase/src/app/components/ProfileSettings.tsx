import { User, Mail, Phone, Lock, Bell, CreditCard, Globe, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { AccountLayout } from "./AccountLayout";

export function ProfileSettings() {
  const [showPassword, setShowPassword] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(true);

  return (
    <AccountLayout activePage="settings">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-2xl mb-2">Profile Settings</h3>
          <p className="text-[var(--color-text-muted)]">
            Manage your account information and preferences
          </p>
        </div>

        {/* Profile Picture */}
        <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
          <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Picture
          </h4>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-24 h-24 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-white text-3xl font-bold font-['Playfair_Display']">
              SJ
            </div>

            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                Upload a profile picture to personalize your account
              </p>
              <div className="flex gap-3">
                <button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-6 py-2 rounded-lg transition-colors uppercase tracking-wide text-sm">
                  Upload Photo
                </button>
                <button className="border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] font-semibold px-6 py-2 rounded-lg transition-colors uppercase tracking-wide text-sm">
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
          <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h4>

          <form className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  defaultValue="Sarah"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  defaultValue="Johnson"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address *
              </label>
              <input
                type="email"
                defaultValue="sarah.j@email.com"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </label>
              <input
                type="tel"
                defaultValue="(555) 123-4567"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Date of Birth
              </label>
              <input
                type="date"
                defaultValue="1990-05-15"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-8 py-3 rounded-lg transition-colors uppercase tracking-wide"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Password & Security */}
        <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
          <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Password & Security
          </h4>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
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

            <div>
              <label className="block text-sm font-medium mb-2">
                New Password *
              </label>
              <input
                type="password"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm New Password *
              </label>
              <input
                type="password"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              Password must be at least 8 characters and include uppercase,
              lowercase, number, and special character
            </p>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-8 py-3 rounded-lg transition-colors uppercase tracking-wide"
              >
                Update Password
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
            <p className="text-sm font-medium mb-3">Two-Factor Authentication</p>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Add an extra layer of security to your account
            </p>
            <button className="border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] font-semibold px-6 py-2 rounded-lg transition-colors uppercase tracking-wide text-sm">
              Enable 2FA
            </button>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
          <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </h4>

          <div className="space-y-4">
            <div className="flex items-start justify-between pb-4 border-b border-[var(--color-border)]">
              <div className="flex-1">
                <p className="font-medium mb-1">Email Notifications</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Receive updates and offers via email
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>

            <div className="flex items-start justify-between pb-4 border-b border-[var(--color-border)]">
              <div className="flex-1">
                <p className="font-medium mb-1">SMS Notifications</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Get text messages for urgent updates
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsNotifications}
                  onChange={(e) => setSmsNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>

            <div className="flex items-start justify-between pb-4 border-b border-[var(--color-border)]">
              <div className="flex-1">
                <p className="font-medium mb-1">Order Updates</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Notifications about your order status
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={orderUpdates}
                  onChange={(e) => setOrderUpdates(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium mb-1">Promotions & Deals</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Special offers and personalized recommendations
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={promotions}
                  onChange={(e) => setPromotions(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[var(--color-primary)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
          <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Saved Payment Methods
          </h4>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-4 border-2 border-[var(--color-primary)] rounded-lg bg-[var(--color-primary)]/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold">
                  VISA
                </div>
                <div>
                  <p className="font-medium">•••• 4242</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Expires 12/2026
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[var(--color-primary)] text-white px-2 py-1 rounded-[var(--radius-pill)] font-semibold uppercase">
                  Default
                </span>
                <button className="text-sm text-[var(--color-primary)] hover:underline font-semibold">
                  Edit
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 bg-gradient-to-r from-orange-600 to-orange-400 rounded flex items-center justify-center text-white text-xs font-bold">
                  MC
                </div>
                <div>
                  <p className="font-medium">•••• 8888</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Expires 08/2025
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-sm text-[var(--color-primary)] hover:underline font-semibold">
                  Edit
                </button>
                <button className="text-sm text-[var(--color-error)] hover:underline font-semibold">
                  Remove
                </button>
              </div>
            </div>
          </div>

          <button className="w-full md:w-auto border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide">
            + Add Payment Method
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 md:p-8">
          <h4 className="font-semibold text-lg mb-2 text-[var(--color-error)]">
            Danger Zone
          </h4>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>
          <button className="bg-[var(--color-error)] hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide">
            Delete Account
          </button>
        </div>
      </div>
    </AccountLayout>
  );
}
