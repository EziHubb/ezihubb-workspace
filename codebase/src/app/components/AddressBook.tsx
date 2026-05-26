import { Plus, Home, Briefcase, MapPin, Edit2, Trash2, Check } from "lucide-react";
import { useState } from "react";
import { AccountLayout } from "./AccountLayout";

interface Address {
  id: number;
  label: "Home" | "Work" | "Other";
  isDefault: boolean;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}

const mockAddresses: Address[] = [
  {
    id: 1,
    label: "Home",
    isDefault: true,
    name: "Sarah Johnson",
    addressLine1: "123 Main Street",
    addressLine2: "Apt 4B",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    country: "United States",
    phone: "(555) 123-4567",
  },
  {
    id: 2,
    label: "Work",
    isDefault: false,
    name: "Sarah Johnson",
    addressLine1: "456 Business Ave",
    addressLine2: "Suite 200",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    country: "United States",
    phone: "(555) 987-6543",
  },
  {
    id: 3,
    label: "Other",
    isDefault: false,
    name: "Mom - Linda Johnson",
    addressLine1: "789 Oak Street",
    addressLine2: "",
    city: "Sacramento",
    state: "CA",
    zipCode: "95814",
    country: "United States",
    phone: "(555) 456-7890",
  },
];

export function AddressBook() {
  const [addresses, setAddresses] = useState(mockAddresses);
  const [showAddForm, setShowAddForm] = useState(false);

  const setDefaultAddress = (id: number) => {
    setAddresses(
      addresses.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
    );
  };

  const deleteAddress = (id: number) => {
    setAddresses(addresses.filter((addr) => addr.id !== id));
  };

  const getLabelIcon = (label: Address["label"]) => {
    switch (label) {
      case "Home":
        return <Home className="w-4 h-4" />;
      case "Work":
        return <Briefcase className="w-4 h-4" />;
      case "Other":
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getLabelColor = (label: Address["label"]) => {
    switch (label) {
      case "Home":
        return "bg-[var(--color-primary)]/10 text-[var(--color-primary)]";
      case "Work":
        return "bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
      case "Other":
        return "bg-gray-100 text-[var(--color-text-muted)]";
    }
  };

  return (
    <AccountLayout activePage="addresses">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-2xl mb-2">Address Book</h3>
            <p className="text-[var(--color-text-muted)]">
              Manage your shipping and billing addresses
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide"
          >
            <Plus className="w-5 h-5" />
            Add Address
          </button>
        </div>

        {/* Add Address Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm border-2 border-[var(--color-primary)]">
            <h4 className="font-semibold text-lg mb-6">Add New Address</h4>

            <form className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Address Type
                  </label>
                  <select className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20">
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  placeholder="Street address"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  placeholder="Apt, suite, unit, etc. (optional)"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    placeholder="CA"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    placeholder="12345"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Country *
                  </label>
                  <select className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20">
                    <option>United States</option>
                    <option>Canada</option>
                    <option>Mexico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="setDefault"
                  className="w-4 h-4 text-[var(--color-primary)] border-[var(--color-border)] rounded focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
                <label htmlFor="setDefault" className="text-sm">
                  Set as default address
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold py-3 rounded-lg transition-colors uppercase tracking-wide"
                >
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 border-2 border-[var(--color-border)] text-[var(--color-secondary)] hover:border-[var(--color-primary)] font-semibold py-3 rounded-lg transition-colors uppercase tracking-wide"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Saved Addresses */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative ${
                address.isDefault ? "ring-2 ring-[var(--color-primary)]" : ""
              }`}
            >
              {/* Default Badge */}
              {address.isDefault && (
                <div className="absolute top-4 right-4 bg-[var(--color-primary)] text-white px-3 py-1 rounded-[var(--radius-pill)] text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Default
                </div>
              )}

              {/* Address Type Label */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-semibold mb-4 ${getLabelColor(
                  address.label
                )}`}
              >
                {getLabelIcon(address.label)}
                {address.label}
              </div>

              {/* Address Details */}
              <div className="mb-4">
                <p className="font-semibold mb-2">{address.name}</p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {address.addressLine1}
                  {address.addressLine2 && (
                    <>
                      <br />
                      {address.addressLine2}
                    </>
                  )}
                  <br />
                  {address.city}, {address.state} {address.zipCode}
                  <br />
                  {address.country}
                  <br />
                  {address.phone}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
                {!address.isDefault && (
                  <button
                    onClick={() => setDefaultAddress(address.id)}
                    className="flex-1 text-sm text-[var(--color-primary)] hover:underline font-semibold"
                  >
                    Set as Default
                  </button>
                )}
                <button className="flex items-center gap-1 text-sm text-[var(--color-secondary)] hover:text-[var(--color-primary)] font-semibold">
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => deleteAddress(address.id)}
                  disabled={address.isDefault}
                  className={`flex items-center gap-1 text-sm font-semibold ${
                    address.isDefault
                      ? "text-[var(--color-text-muted)] cursor-not-allowed"
                      : "text-[var(--color-error)] hover:underline"
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {addresses.length === 0 && !showAddForm && (
          <div className="bg-white rounded-xl p-12 md:p-16 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-[var(--color-text-muted)]" />
            </div>
            <h4 className="font-semibold text-xl mb-2">
              No addresses saved yet
            </h4>
            <p className="text-[var(--color-text-muted)] mb-6">
              Add an address to speed up your checkout process
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold px-8 py-3 rounded-lg transition-colors uppercase tracking-wide"
            >
              Add Your First Address
            </button>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
