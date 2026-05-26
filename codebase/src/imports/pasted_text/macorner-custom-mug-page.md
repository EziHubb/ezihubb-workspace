Design the product detail page with customizer for Macorner.
Product: "Custom Name & Photo Coffee Mug — $27.99"
Create TWO frames: Desktop 1440×auto, Mobile 390×auto.
━━━ [DESKTOP 1440px] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Navbar]
BREADCRUMB: Home > Mugs > Custom Name & Photo Coffee Mug
MAIN LAYOUT (max-width 1280px, 2 cols: 55% left / 45% right, 48px gap, mt 24px):
─ LEFT — IMAGE GALLERY ─
Main image: large square ~640px, white rounded 16px, drop shadow
Product: white mug mockup with personalized design (couple names + watercolor illustration)
"🔥 In demand — 47 people bought this in the last 24 hours" — coral chip badge below image left
Thumbnail strip (mt 12px, 12px gap): 5 × 88px thumbnails, active = 2px coral border, 8px radius
"🔍 Click to zoom" caption muted below strip right
─ RIGHT — INFO + CUSTOMIZER (sticky top 88px) ─
PRODUCT INFO:
H1 36px: "Custom Name & Photo Coffee Mug"
Rating row (mt 8px): ⭐⭐⭐⭐⭐ "4.9" bold  +  "(312 reviews)" coral link  +  "|"  +  "2,847 sold"
PRICE ROW (mt 16px): "$27.99" H2 coral  +  "$34.99" muted strikethrough  +  "Save 20%" green badge pill
Short description Body muted (mt 12px): "Add names, a photo, and your message — preview exactly how it looks before ordering."
VARIANT SELECTOR (mt 20px):
Label H5: "Size"
3 pill buttons (44px h, 16px px): [11oz]  [15oz ✓ selected]  [20oz Tall]
Selected = coral border 2px + Primary Light bg
Note caption muted: "15oz selected — $27.99"
AUTO-FILL BANNER (mt 16px, bg #FFFBEB amber-50, border #FCD34D, 8px radius, 12px padding):
"💡 You have a previous customization for this product."
"[Auto-fill it]" coral link  +  "or"  +  "[Start fresh]" muted link
CUSTOMIZER PANEL (mt 20px, bg #FFF8F5, border #E8D5CC 1px, 16px radius, 24px padding):
Header row: "✏️ Personalize Your Mug" H4  +  "Required *" coral caption right
FIELD 1 — NAMES OR TEXT (mt 16px):
  Label "Names or Text" H5  +  "* required" coral
  Text input (full width): placeholder "e.g. John & Sarah"
  Below row: "💬 Tip: Keep it under 20 chars for best results" caption muted left  +  "12 / 30" right

FIELD 2 — UPLOAD PHOTO (mt 20px):
  Label "Upload a Photo" H5  +  "(optional)" muted
  UPLOAD ZONE (dashed border #E8D5CC, 8px radius, 100px height, center content):
    ☁ upload icon (32px coral)
    "Drop photo here or click to browse" Body
    "JPG, PNG, HEIC up to 10MB" Caption muted
  UPLOADED STATE (show as second variant):
    Thumbnail 64px left  +  filename.jpg muted  +  progress bar if uploading
    Action buttons row: [✂️ Crop] [🪄 Remove BG] [🔄 Replace]  (Ghost SM buttons)
    "Remove BG" button: shows "✨ AI-powered" badge

FIELD 3 — ART STYLE (mt 20px):
  Label "Art Style" H5  +  "* required" coral
  2×2 grid (8px gap) of style cards (each ~130×80px):
    Each card: preview illustration top (small watercolor/cartoon/etc swatch) + style name Body SM bold
    Card bg white, border #E8D5CC, 8px radius
    Selected card: coral border 2px + checkmark icon top-right coral circle
    Cards: Watercolor ✓(selected) | Cartoon | Realistic | Van Gogh

FIELD 4 — MESSAGE (mt 20px):
  Label "Personal Message" H5  +  "(optional)" muted
  Textarea 80px height: placeholder "Add a special message..."
  "0 / 100" count right

PREVIEW BUTTON (mt 20px, full width):
  Secondary LG button (coral outline): "👁️ Generate Preview  —  takes ~20 sec"
  LOADING STATE variant: spinner + "Generating your preview..." + coral progress bar
ADD TO CART (mt 16px):
Primary LG full width: "Add to Cart  —  $27.99"
DISABLED state (gray, tooltip): "Please complete all required fields"
Trust strip (mt 12px, 3 items with icons, centered):
🚚 "Ships in 3–5 business days"  |  ✅ "Cancel within 2 hours"  |  🔒 "Secure checkout"
─ PRODUCT TABS SECTION (mt 48px, full width border-top pt 32px) ─
Tabs: [Description] [Size Guide] [Shipping & Returns] [Reviews (312)]
Active tab = coral underline 2px, H5 bold
Description content: 2-col feature list (icon + text)
─ REVIEWS SECTION (mt 48px) ─
Header row: H3 "Customer Reviews"  +  "Write a Review" Secondary SM button
Summary row (mb 24px):
BIG "4.9" (Display XL coral left)  +  5 large stars  +  "Based on 312 reviews"
Distribution bars right: 5★ ████████▓▓ 78%  |  4★ ████▓▓▓▓▓▓ 15%  |  3★ ▓▓▓▓▓▓▓▓▓▓ 5%  etc
Filter row: [All Stars ▾]  [Most Recent ▾]  [With Photos ☐]
3 review cards (vertical stack, dividers):
Avatar MD + "Sarah J." bold + "Verified Purchase ✓" green + date muted right
⭐⭐⭐⭐⭐ + title "Absolutely love it! 😍"
Body review text 3 lines
Customer photo thumbnail (80px) if uploaded
"Helpful? 👍 12" muted action
─ RELATED PRODUCTS (mt 64px) ─
H3 "You Might Also Like"
4 ProductCards horizontal row
━━━ [MOBILE 390px] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Mobile Navbar — back arrow left, "Custom Mug" title center, ❤️ wishlist + 🛍 cart right]
SINGLE COLUMN LAYOUT (px 16px):
IMAGE GALLERY (full-bleed, no px):
Main image: 390×390px, object-fit cover
Top overlay (gradient bottom): "🔥 47 bought in 24h" chip bottom-left
Thumbnail strip: 5 × 56px thumbnails, horizontal scroll, px 16px
PRODUCT INFO (px 16px, pt 16px):
H1 26px (smaller): "Custom Name & Photo Coffee Mug"
Rating + sold count row (mt 6px)
Price row (mt 10px): "$27.99" H2 coral + strikethrough + badge
VARIANT PILLS (mt 16px, px 0):
[11oz]  [15oz ✓]  [20oz] — same pills but slightly larger tap targets 40px min-height
AUTO-FILL BANNER (mt 12px, full-width)
CUSTOMIZER PANEL (mt 16px, bg #FFF8F5, 12px radius, 16px padding):
All fields full-width single column (same fields as desktop)
Style cards: 2×2 grid, cards taller for better tap (80px each)
Upload zone: 80px height
PREVIEW BUTTON: full-width Secondary LG
STICKY BOTTOM ADD-TO-CART BAR (fixed bottom, above bottom nav, bg white, shadow top):
Left: "$27.99" H3 coral  +  "Size: 15oz" caption muted
Right: [Add to Cart] Primary MD
PRODUCT TABS (mt 32px):
Horizontal scrollable tab bar (Description | Size | Shipping | Reviews)
Active tab underline coral
REVIEWS (mt 24px):
Summary: rating number + stars centered
Distribution bars full-width
3 review cards stacked
[Fixed Bottom Navbar]