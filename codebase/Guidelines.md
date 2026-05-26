# Macorner Design System Guidelines

**Brand Identity:** Warm, joyful, and modern e-commerce for personalized gifts

---

## Color Palette

### Primary Colors
```css
--color-primary: #E85D3F;           /* Warm coral-orange - main CTAs, highlights */
--color-primary-dark: #C44A2E;      /* Hover states */
--color-secondary: #2D2D2D;         /* Headings, body text */
```

### Surface & Background
```css
--color-background: #FAFAF8;        /* Page background - warm off-white */
--color-surface: #FFFFFF;           /* Cards, modals */
--color-border: #E8E4DF;            /* Subtle dividers */
```

### Semantic Colors
```css
--color-success: #2E7D52;           /* Order confirmed, in stock */
--color-warning: #D97706;           /* Price changed alerts */
--color-error: #DC2626;             /* Form errors */
```

### Text Colors
```css
--color-text-primary: #2D2D2D;      /* Main text */
--color-text-muted: #6B6B6B;        /* Secondary text, placeholders */
```

### Badge Colors
```css
--color-badge-new: #7C3AED;         /* Purple - New badge */
--color-badge-sale: #E85D3F;        /* Primary - Sale badge */
--color-badge-hot: #DC2626;         /* Red - Hot badge */
```

---

## Typography

### Font Families
```css
--font-display: 'Playfair Display', serif;   /* Headings H1, H2, section titles */
--font-body: 'Inter', sans-serif;            /* All body text, UI labels, buttons */
```

### Font Imports
Add to `src/styles/fonts.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;600&display=swap');
```

### Type Scale
```css
/* Headings */
--text-h1: 700 48px/1.2 var(--font-display);           /* Playfair Display Bold */
--text-h2: 600 36px/1.25 var(--font-display);          /* Playfair Display SemiBold */
--text-h3: 600 24px/1.3 var(--font-body);              /* Inter SemiBold */
--text-h4: 600 18px/1.4 var(--font-body);              /* Inter SemiBold */

/* Body */
--text-body-lg: 400 16px/1.6 var(--font-body);         /* Inter Regular */
--text-body: 400 14px/1.5 var(--font-body);            /* Inter Regular */
--text-caption: 400 12px/1.4 var(--font-body);         /* Inter Regular */

/* UI Elements */
--text-button: 600 14px/1 var(--font-body);            /* Inter SemiBold, uppercase, tracking-wide */
```

---

## Spacing System

Based on 4px grid:
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
--space-24: 96px;
```

**Usage Guidelines:**
- Component padding: `--space-4` to `--space-6`
- Section spacing: `--space-12` to `--space-16`
- Page margins: `--space-8` to `--space-24`

---

## Border Radius

```css
--radius-button: 8px;
--radius-card: 12px;
--radius-modal: 16px;
--radius-pill: 999px;          /* Full round for badges */
```

---

## Shadows

```css
--shadow-floating: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.10);
--shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.15);
```

---

## Components

### Button

**Variants:**
- **Primary:** Background `--color-primary`, white text, hover `--color-primary-dark`
- **Secondary:** Border `--color-border`, text `--color-secondary`, subtle hover background
- **Ghost:** Transparent background, text `--color-secondary`, hover background subtle gray
- **Destructive:** Background `--color-error`, white text

**Sizes:**
- **sm:** padding `8px 16px`, text `12px`
- **md:** padding `12px 24px`, text `14px` (default)
- **lg:** padding `16px 32px`, text `16px`

**States:**
- **Default:** Standard appearance
- **Hover:** Transition background 200ms ease
- **Loading:** Show spinner icon, disable pointer events, reduce opacity to 0.7
- **Disabled:** Opacity 0.5, cursor not-allowed

**Typography:** Use `--text-button` (Inter SemiBold, 14px, uppercase, `letter-spacing: 0.05em`)

```tsx
<button className="btn-primary btn-md">Add to Cart</button>
```

---

### Input

**States:**
- **Default:** Border `--color-border`, background `--color-surface`, text `--color-text-primary`
- **Focused:** Border `--color-primary`, outline none, subtle shadow
- **Error:** Border `--color-error`, show error message below in `--color-error`
- **Disabled:** Background `#F5F5F5`, cursor not-allowed, opacity 0.6

**Structure:**
- Padding: `12px 16px`
- Border radius: `--radius-button`
- Font: `--text-body`
- Label above input with `--space-2` gap

```tsx
<input 
  type="text" 
  className="input" 
  placeholder="Enter your name"
/>
```

---

### Badge

**Variants:**
- **New:** Background `--color-badge-new`, white text
- **Sale:** Background `--color-badge-sale`, white text
- **Hot:** Background `--color-badge-hot`, white text
- **In-demand:** Background `--color-warning`, white text

**Status Badges:**
- **Pending:** Background `#FEF3C7`, text `#92400E`
- **Confirmed:** Background `#D1FAE5`, text `--color-success`
- **Shipped:** Background `#DBEAFE`, text `#1E40AF`
- **Delivered:** Background `#D1FAE5`, text `--color-success`
- **Completed:** Background `#E5E7EB`, text `--color-secondary`
- **Cancelled:** Background `#FEE2E2`, text `--color-error`

**Structure:**
- Padding: `4px 12px`
- Border radius: `--radius-pill`
- Font: `--text-caption`, uppercase, `letter-spacing: 0.05em`, font-weight 600

```tsx
<span className="badge badge-sale">Sale</span>
<span className="badge badge-status-confirmed">Confirmed</span>
```

---

### ProductCard

**Structure:**
- Border radius: `--radius-card`
- Background: `--color-surface`
- Border: `1px solid var(--color-border)`
- Padding: `--space-4`

**States:**
- **Default:** Subtle border, no shadow
- **Hover:** Border `--color-primary`, shadow `--shadow-card-hover`, transition 200ms
- **Wishlist Active:** Heart icon filled with `--color-error`

**Contents:**
- Product image (aspect ratio 1:1 or 4:5)
- Badge overlay (top-right, absolute positioned)
- Product name (`--text-h4`)
- Price (`--text-body-lg`, color `--color-primary`, font-weight 600)
- Original price if on sale (strikethrough, `--color-text-muted`)
- Rating stars below price
- Wishlist heart icon (top-right or bottom-right)

```tsx
<div className="product-card">
  <img src="..." alt="..." />
  <span className="badge badge-new">New</span>
  <h4>Personalized Mug</h4>
  <div className="price">$24.99 <span className="original-price">$34.99</span></div>
  <RatingStars rating={4.5} size="sm" />
</div>
```

---

### RatingStars

**Sizes:**
- **sm:** 14px star size
- **md:** 18px star size

**States:**
- **Filled:** Color `--color-warning` (gold)
- **Empty:** Color `--color-border`
- **Half:** Use gradient or overlay technique for half-filled stars

**Structure:**
- Use SVG star icons
- Display inline with `gap: --space-1`

```tsx
<RatingStars rating={4.5} size="md" />
```

---

### Avatar

**Sizes:**
- **xs:** 24px
- **sm:** 32px
- **md:** 40px
- **lg:** 56px

**Structure:**
- Border radius: 50% (full circle)
- Background: `--color-primary` for initials fallback
- Text color: white
- Font: Inter SemiBold

**Fallback:** If no image, show initials centered (first letter of first and last name)

```tsx
<Avatar src="..." alt="John Doe" size="md" />
<Avatar initials="JD" size="md" />
```

---

### Toast

**Variants:**
- **Success:** Background `--color-success`, white text, checkmark icon
- **Error:** Background `--color-error`, white text, X icon
- **Warning:** Background `--color-warning`, white text, alert icon
- **Info:** Background `--color-secondary`, white text, info icon

**Structure:**
- Padding: `16px 20px`
- Border radius: `--radius-button`
- Shadow: `--shadow-modal`
- Position: Fixed, top-right or bottom-right
- Animation: Slide in from right, auto-dismiss after 5s
- Close button (X icon) on the right

```tsx
<Toast variant="success" message="Item added to cart!" />
```

---

## Layout Principles

### Container Widths
```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1440px;
```

### Grid System
- Use CSS Grid or Flexbox
- Product grids: 2 columns mobile, 3 columns tablet, 4 columns desktop
- Gap: `--space-6` or `--space-8`

### Responsive Breakpoints
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### Page Structure
- Header: Fixed or sticky, background `--color-surface`, shadow `--shadow-floating`
- Main content: Max-width container, centered
- Footer: Background `--color-secondary`, white text
- Sections: Vertical spacing `--space-16` to `--space-24`

---

## Interaction Patterns

### Hover States
- Transitions: 200ms ease for background, border, transform
- Buttons: Darken background or show shadow
- Cards: Lift with shadow, subtle border color change
- Links: Underline or color change to `--color-primary`

### Focus States
- Outline: `2px solid var(--color-primary)`, offset `2px`
- Remove default browser outline, add custom ring

### Loading States
- Skeleton loaders: Background `#F3F4F6`, animated pulse
- Spinners: Border spinner using `--color-primary`
- Disabled buttons: Show spinner, reduce opacity

---

## Accessibility

- Maintain WCAG AA contrast ratios (4.5:1 for body text, 3:1 for large text)
- All interactive elements keyboard accessible (tab order, focus visible)
- Form inputs have associated labels
- Images have descriptive alt text
- Semantic HTML (`<button>` not `<div>` for clickable elements)

---

## Animation Guidelines

- **Subtle & purposeful:** Animations enhance, not distract
- **Duration:** 150-300ms for micro-interactions, 400-600ms for transitions
- **Easing:** `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for movements
- **Examples:**
  - Button hover: background color 200ms ease
  - Modal open: scale from 0.95 to 1, fade in, 300ms ease-out
  - Toast notification: slide in from right 400ms ease-out
  - Product card hover: lift 200ms ease, shadow fade in

---

## Best Practices

1. **Consistency:** Use design tokens from this guide, never hardcode values
2. **Hierarchy:** Use typography scale to establish clear visual hierarchy
3. **Whitespace:** Embrace generous spacing, especially around CTAs and key content
4. **Mobile-first:** Design for small screens first, progressively enhance
5. **Performance:** Optimize images, lazy-load off-screen content
6. **Brand warmth:** The coral-orange primary color is the brand's signature—use it strategically for CTAs and accents to create moments of joy

---

## Component Implementation Notes

All components should be built as reusable React components in `src/app/components/`. Import design tokens from `src/styles/theme.css` and apply using Tailwind CSS classes or CSS custom properties.

Example component structure:
```
src/app/components/
├── Button.tsx
├── Input.tsx
├── Badge.tsx
├── ProductCard.tsx
├── RatingStars.tsx
├── Avatar.tsx
└── Toast.tsx
```
