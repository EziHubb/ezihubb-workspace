import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProductCard } from '../ProductCard';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} alt={rest.alt ?? ''} />;
  },
}));

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock apiClient (wishlist calls)
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock currency context
jest.mock('../../../lib/currency/currency-context', () => ({
  useCurrency: () => ({
    format: (val: number) => `$${val.toFixed(2)}`,
    currency: 'USD',
  }),
}));

// Mock @ezihubb/ui
jest.mock('@ezihubb/ui', () => ({
  RatingStars: ({ rating }: { rating: number }) => <span data-testid="rating-stars">{rating}</span>,
}));

// Mock @ezihubb/constants
jest.mock('@ezihubb/constants', () => ({
  API_ROUTES: { wishlist: { toggle: '/api/v1/wishlist/toggle' } },
}));

const defaultProps = {
  slug: 'custom-mug',
  locale: 'en',
  image: '/test-image.jpg',
  name: 'Custom Name Mug',
  price: 27.99,
};

describe('ProductCard', () => {
  it('renders product name', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('Custom Name Mug')).toBeInTheDocument();
  });

  it('renders product price', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText('$27.99')).toBeInTheDocument();
  });

  it('renders product image', () => {
    render(<ProductCard {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/test-image.jpg');
  });

  it('links to correct product URL', () => {
    render(<ProductCard {...defaultProps} />);
    const links = screen.getAllByRole('link');
    const productLink = links.find((l) => l.getAttribute('href')?.includes('/products/custom-mug'));
    expect(productLink).toBeTruthy();
  });

  it('shows original price when provided', () => {
    render(<ProductCard {...defaultProps} originalPrice={39.99} />);
    expect(screen.getByText('$39.99')).toBeInTheDocument();
  });

  it('shows sale badge when badge = sale', () => {
    render(<ProductCard {...defaultProps} badge="sale" />);
    expect(screen.getByText(/sale/i)).toBeInTheDocument();
  });

  it('shows new badge when badge = new', () => {
    render(<ProductCard {...defaultProps} badge="new" />);
    expect(screen.getByText(/new/i)).toBeInTheDocument();
  });

  it('shows low stock label when lowStock = true', () => {
    render(<ProductCard {...defaultProps} lowStock={true} />);
    expect(screen.getByText(/low stock/i)).toBeInTheDocument();
  });

  it('shows custom labelLowStock when provided', () => {
    render(<ProductCard {...defaultProps} lowStock={true} labelLowStock="Sắp hết hàng" />);
    expect(screen.getByText(/Sắp hết hàng/)).toBeInTheDocument();
  });

  it('renders rating stars component', () => {
    render(<ProductCard {...defaultProps} rating={4.5} reviewCount={12} />);
    expect(screen.getByTestId('rating-stars')).toBeInTheDocument();
  });

  it('renders Personalize Now button', () => {
    render(<ProductCard {...defaultProps} />);
    expect(screen.getByText(/personalize now/i)).toBeInTheDocument();
  });

  it('renders custom labelPersonalize when provided', () => {
    render(<ProductCard {...defaultProps} labelPersonalize="Tuỳ chỉnh ngay" />);
    expect(screen.getByText('Tuỳ chỉnh ngay')).toBeInTheDocument();
  });
});
