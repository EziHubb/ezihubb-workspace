import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShippingForm } from '../ShippingForm';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));

// Mock @mlh/constants
jest.mock('@mlh/constants', () => ({
  API_ROUTES: {},
  ADMIN_ROUTES: {},
}));

// Mock @mlh/api-client hooks to avoid needing QueryClientProvider
jest.mock('@mlh/api-client', () => ({
  useAddresses: () => ({ data: [] }),
  useProfile: () => ({ data: null }),
}));

describe('ShippingForm', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    mockOnComplete.mockClear();
  });

  // ── Guest mode (isLoggedIn = false) ───────────────────────────────────────
  describe('Guest mode (isLoggedIn = false)', () => {
    beforeEach(() => {
      render(<ShippingForm isLoggedIn={false} onComplete={mockOnComplete} />);
    });

    it('shows email field for guest', () => {
      // The email input has name="email" and placeholder, but no aria-label/htmlFor
      // so we query by the input's name attribute.
      const emailInput = document.querySelector('input[name="email"]');
      expect(emailInput).toBeInTheDocument();
    });

    it('shows email validation error for invalid email on submit', async () => {
      // Type an invalid email, then submit
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      await userEvent.type(emailInput, 'not-an-email');

      const submitBtns = screen.getAllByRole('button', { name: /continue to delivery/i });
      await userEvent.click(submitBtns[0]);

      await waitFor(() => {
        expect(screen.getByText(/valid email required/i)).toBeInTheDocument();
      });
    });
  });

  // ── Auth user mode (isLoggedIn = true) ────────────────────────────────────
  describe('Auth user mode (isLoggedIn = true)', () => {
    beforeEach(() => {
      render(<ShippingForm isLoggedIn={true} onComplete={mockOnComplete} />);
    });

    it('does NOT show email field for logged-in user', () => {
      const emailInput = document.querySelector('input[name="email"]');
      expect(emailInput).not.toBeInTheDocument();
    });
  });

  // ── Required field validation ─────────────────────────────────────────────
  describe('Required field validation', () => {
    it('shows error for empty first name', async () => {
      render(<ShippingForm isLoggedIn={true} onComplete={mockOnComplete} />);
      const submitBtns = screen.getAllByRole('button', { name: /continue to delivery/i });
      await userEvent.click(submitBtns[0]);

      await waitFor(() => {
        const errors = screen.getAllByText(/required/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });
});
