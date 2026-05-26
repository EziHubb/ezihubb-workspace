# Macorner Design System - Implementation Guide

This document explains how to use the Macorner design system with the existing component library in this project.

## Quick Start

The Macorner design system is fully configured and ready to use:

1. **Design tokens** are defined in `src/styles/theme.css`
2. **Typography** (Playfair Display + Inter) is imported in `src/styles/fonts.css`
3. **Full guidelines** are in `Guidelines.md`

## Using Design Tokens

All design tokens are available as CSS custom properties:

```tsx
// In your components, use Tailwind utilities that map to tokens:
<div className="bg-surface border border-border rounded-card p-4">
  <h2>Personalized Mug</h2>
  <p className="text-text-muted">Perfect gift for coffee lovers</p>
</div>

// Or use CSS custom properties directly:
<button style={{ 
  backgroundColor: 'var(--color-primary)',
  borderRadius: 'var(--radius-button)',
  padding: 'var(--space-4) var(--space-6)'
}}>
  Add to Cart
</button>
```

## Component Examples

### Button (Primary CTA)

Use the existing Button component styled with Macorner tokens:

```tsx
import { Button } from "./components/ui/button";

<Button 
  className="bg-primary hover:bg-primary-dark text-white font-semibold uppercase tracking-wide rounded-[8px] transition-all duration-200"
>
  Add to Cart
</Button>
```

### Badge (Sale, New, Hot)

```tsx
import { Badge } from "./components/ui/badge";

<Badge className="bg-badge-sale text-white rounded-pill px-3 py-1 text-xs uppercase font-semibold tracking-wide">
  Sale
</Badge>

<Badge className="bg-badge-new text-white rounded-pill px-3 py-1 text-xs uppercase font-semibold tracking-wide">
  New
</Badge>

<Badge className="bg-badge-hot text-white rounded-pill px-3 py-1 text-xs uppercase font-semibold tracking-wide">
  Hot
</Badge>
```

### Input with Label

```tsx
import { Input } from "./components/ui/input";

<div className="flex flex-col gap-2">
  <label className="text-sm font-medium">Email Address</label>
  <Input 
    type="email"
    placeholder="you@example.com"
    className="border-border focus:border-primary rounded-[8px] px-4 py-3"
  />
</div>
```

### Product Card

Create a reusable ProductCard component:

```tsx
// src/app/components/ProductCard.tsx
import { Heart } from "lucide-react";
import { Badge } from "./ui/badge";

interface ProductCardProps {
  image: string;
  name: string;
  price: number;
  originalPrice?: number;
  rating?: number;
  badge?: "new" | "sale" | "hot";
  isWishlisted?: boolean;
  onWishlistToggle?: () => void;
}

export function ProductCard({
  image,
  name,
  price,
  originalPrice,
  rating,
  badge,
  isWishlisted,
  onWishlistToggle
}: ProductCardProps) {
  return (
    <div className="bg-surface border border-border rounded-card p-4 hover:border-primary hover:shadow-card-hover transition-all duration-200 relative group">
      {/* Badge */}
      {badge && (
        <Badge className={`
          absolute top-2 right-2 z-10 rounded-pill px-3 py-1 text-xs uppercase font-semibold tracking-wide text-white
          ${badge === 'new' ? 'bg-badge-new' : ''}
          ${badge === 'sale' ? 'bg-badge-sale' : ''}
          ${badge === 'hot' ? 'bg-badge-hot' : ''}
        `}>
          {badge}
        </Badge>
      )}

      {/* Image */}
      <div className="aspect-square mb-4 overflow-hidden rounded-lg">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Product Info */}
      <h4 className="font-semibold text-lg mb-2">{name}</h4>
      
      {/* Price */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary font-semibold text-lg">
          ${price.toFixed(2)}
        </span>
        {originalPrice && (
          <span className="text-text-muted line-through text-sm">
            ${originalPrice.toFixed(2)}
          </span>
        )}
      </div>

      {/* Rating */}
      {rating && (
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < Math.floor(rating) ? "text-warning" : "text-border"}>
              ★
            </span>
          ))}
          <span className="text-sm text-text-muted ml-1">({rating})</span>
        </div>
      )}

      {/* Wishlist */}
      <button
        onClick={onWishlistToggle}
        className="absolute bottom-4 right-4 p-2 rounded-full hover:bg-background transition-colors"
      >
        <Heart 
          className={`w-5 h-5 ${isWishlisted ? 'fill-error text-error' : 'text-text-muted'}`}
        />
      </button>
    </div>
  );
}
```

### Toast Notifications

Using Sonner (already installed):

```tsx
import { toast } from "sonner";

// Success
toast.success("Item added to cart!", {
  style: {
    background: 'var(--color-success)',
    color: 'white',
    borderRadius: 'var(--radius-button)',
  }
});

// Error
toast.error("Something went wrong", {
  style: {
    background: 'var(--color-error)',
    color: 'white',
    borderRadius: 'var(--radius-button)',
  }
});

// Warning
toast.warning("Price has changed", {
  style: {
    background: 'var(--color-warning)',
    color: 'white',
    borderRadius: 'var(--radius-button)',
  }
});
```

### Avatar

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";

<Avatar className="w-10 h-10">
  <AvatarImage src="/user-photo.jpg" alt="John Doe" />
  <AvatarFallback className="bg-primary text-white font-semibold">
    JD
  </AvatarFallback>
</Avatar>
```

## Typography Usage

The project uses two font families:

- **Playfair Display** (serif) for headings and display text
- **Inter** (sans-serif) for body text, UI elements, and buttons

```tsx
// Headings automatically use the correct font family via theme.css
<h1>Welcome to Macorner</h1>  {/* Playfair Display, 48px, bold */}
<h2>Shop Personalized Gifts</h2>  {/* Playfair Display, 36px, semibold */}
<h3>Categories</h3>  {/* Inter, 24px, semibold */}
<h4>Featured Products</h4>  {/* Inter, 18px, semibold */}

// Body text uses Inter by default
<p>Browse our collection of personalized gifts.</p>

// Button text (uppercase, tracking-wide)
<button className="font-semibold uppercase tracking-wide">
  Shop Now
</button>
```

## Layout Structure

### Container Widths

```tsx
// Centered container with max-width
<div className="max-w-[1280px] mx-auto px-8">
  {/* Your content */}
</div>
```

### Product Grid

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
  <ProductCard {...product1} />
  <ProductCard {...product2} />
  <ProductCard {...product3} />
  {/* ... */}
</div>
```

### Section Spacing

```tsx
<section className="py-16 md:py-24">
  <h2 className="mb-12">Featured Products</h2>
  {/* Content */}
</section>
```

## Color Reference

Quick reference for common colors:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | #E85D3F | CTA buttons, highlights |
| `--color-primary-dark` | #C44A2E | Hover states |
| `--color-secondary` | #2D2D2D | Headings, body text |
| `--color-background` | #FAFAF8 | Page background |
| `--color-surface` | #FFFFFF | Cards, modals |
| `--color-border` | #E8E4DF | Dividers |
| `--color-success` | #2E7D52 | Success messages |
| `--color-warning` | #D97706 | Warnings |
| `--color-error` | #DC2626 | Errors |
| `--color-text-muted` | #6B6B6B | Secondary text |

## Spacing Reference

All spacing uses a 4px base grid:

```tsx
// Tailwind classes
p-1    // 4px
p-2    // 8px
p-3    // 12px
p-4    // 16px
p-6    // 24px
p-8    // 32px
p-12   // 48px
p-16   // 64px
p-24   // 96px

// Or use custom properties
style={{ padding: 'var(--space-4)' }}
style={{ marginBottom: 'var(--space-12)' }}
```

## Icons

Use Lucide React (already installed) for icons:

```tsx
import { ShoppingCart, Heart, User, Search, Menu } from "lucide-react";

<ShoppingCart className="w-5 h-5 text-primary" />
<Heart className="w-4 h-4 text-error" />
```

## Animation Guidelines

All animations should be subtle and purposeful:

```tsx
// Hover effects
className="transition-all duration-200 hover:scale-105"

// Button hover
className="transition-colors duration-200 hover:bg-primary-dark"

// Modal/Dialog entrance
className="animate-in fade-in duration-300"
```

## Best Practices

1. **Always use design tokens** - Never hardcode colors, spacing, or typography values
2. **Use semantic color names** - Use `--color-success` instead of `#2E7D52`
3. **Maintain consistency** - Reuse components instead of creating one-offs
4. **Mobile-first** - Design for small screens first, then enhance for larger screens
5. **Accessibility** - Ensure proper contrast ratios and keyboard navigation
6. **Brand warmth** - The coral-orange primary color is the brand signature—use it strategically

## Next Steps

1. Review `Guidelines.md` for complete design specifications
2. Check `src/styles/theme.css` for all available design tokens
3. Build components using the examples above
4. Test responsiveness on mobile, tablet, and desktop
5. Ensure accessibility with proper ARIA labels and keyboard navigation

---

**Happy building!** 🎁
