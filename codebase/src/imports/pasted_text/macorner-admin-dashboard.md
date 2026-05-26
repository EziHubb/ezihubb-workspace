Design the Macorner admin dashboard. Professional, data-dense, dark sidebar.
Create frames: Desktop 1440px only (admin is desktop-primary).
Include 3 artboards: Dashboard Overview | Orders List | Order Detail Drawer.
━━━ [ADMIN LAYOUT — shared across all artboards] ━━━━━━━━
FIXED LEFT SIDEBAR (240px, full-height, bg #1E1E2E, white text):
TOP (p 20px):
Small Macorner logo white (24px) + "Admin" label muted #9CA3AF
NAV ITEMS (mt 24px, each 44px h, 16px px, 8px radius mx 8px):
Each: icon (20px, muted gray) + label (Body SM) + optional badge
Active item: bg #E85D3F/15 + coral icon + white label + left border 3px coral
Items: 📊 Dashboard (active) | 📦 Orders (12 badge) | 🛍️ Products | 📂 Catalog | 👥 Customers | 🏷️ Promotions | ⭐ Reviews (5 badge) | 🚚 Shipping | 💳 Payments | ⚙️ Settings
BOTTOM (absolute bottom, p 16px):
Divider
Avatar SM + "Admin User" white Body SM + "admin@macorner.co" muted caption
[Log Out →] muted link
TOPBAR (right of sidebar, h 64px, bg white, border-bottom):
Page title H3 "Dashboard" left (pl 32px)
Right (pr 32px, row 16px gap): date range picker button "Jun 1 – Jun 30 ▾" | [📤 Export Report] Secondary SM
CONTENT AREA (ml 240px, mt 64px, p 32px, bg #F5F5F7):
━━━ [ARTBOARD 1: DASHBOARD OVERVIEW] ━━━━━━━━━━━━━━━━━━━
ROW 1 — KPI CARDS (4 cards, 24px gap):
Each card (white, 12px radius, 20px padding, Card shadow):
Top row: label H5 muted + trend badge right (↑ +12% green / ↓ -3% red pill)
Big number (Display 40px): "$4,280" / "47" / "12" / "28"
Bottom: icon circle (40px) left + "vs. last period" caption muted
Card 1: 💰 "Revenue Today" | $4,280 | ↑ +12%
Card 2: 📦 "Orders Today" | 47 | ↑ +8%
Card 3: ⏳ "Awaiting Action" | 12 | amber warning color
Card 4: 🔨 "In Production" | 28 | blue info color
ROW 2 — CHARTS (mt 24px, 2 col: 65% / 35%, 24px gap):
LEFT — Line Chart card (white, 16px radius, 24px padding):
H4 "Revenue — Last 30 Days"  +  total "$84,320" coral right
Chart: coral area line chart, x-axis dates, y-axis USD, 400px height
Hover tooltip: white card with date + revenue amount
RIGHT — Donut Chart card (white, 16px radius, 24px padding):
H4 "Orders by Status"
Donut chart (240px, coral/blue/green/yellow segments)
Legend below: colored dot + status name + count + % for each
ROW 3 — DATA TABLES (mt 24px, 2 col: 60% / 40%, 24px gap):
LEFT — Top Products table (white, 16px radius):
Header: H4 "Best Selling Products" + "View All →" link
Table header: Rank | Product | Category | Units Sold | Revenue | Avg Rating
5 rows: rank number | [thumbnail 32px + name] | category pill | 234 | $5,832 | ⭐4.9
Sortable column headers (↕ icon)
RIGHT — Pending Reviews (white, 16px radius):
Header: H4 "Reviews to Approve" + "5 pending" coral badge
Each row (44px, dividers): stars | customer name + product (truncated) | date | [✓ Approve] green icon btn + [🙈 Hide] muted icon btn
━━━ [ARTBOARD 2: ORDERS LIST] ━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPBAR: "Orders" title + subtitle "247 total orders"
FILTER BAR (bg white, p 16px, border-bottom, mb 0):
Row of controls (12px gap):
[Status: All ▾] | [Date: This Month ▾] | [Search: order # or email 🔍 input] | spacer | [📥 Export CSV] Secondary SM
ACTIVE FILTER CHIPS (px 32px pt 12px mb 0 if any active):
"Status: Shipped ×" + "Date: Jun 1–7 ×" coral chips
DATA TABLE (white bg, full-width):
THEAD (bg #F9FAFB, border-bottom, 44px h):
☐ | Order # | Customer | Items | Date | Status | Total | Actions
Column widths: 40 | 130 | 180 | 80 | 120 | 140 | 100 | 120
TBODY (rows 56px h, dividers, hover bg #F9FAFB):
Row 1: ☐ | MC-04521 | "Sarah Johnson" + email caption | "2 items" | Jun 3 | 🔵 Shipped badge | $55.98 | [👁 View] [✏️ Edit] ghost icon buttons
Row 2: ☐ | MC-04520 | Mike Chen | 1 item | Jun 3 | 🟡 In Production | $27.99 | [👁] [✏️]
Row 3: ☐ | MC-04519 | Emma Wilson | 3 items | Jun 2 | ✅ Completed | $89.97 | [👁]
Row 4: ☐ | MC-04518 | James Park | 1 item | Jun 2 | 🔴 Cancelled | $24.99 | [👁]
Row 5: ☐ | MC-04517 | Lisa Chen | 2 items | Jun 1 | ✅ Delivered | $67.98 | [👁] [✏️]
BULK ACTION BAR (shows when rows checked, bg Primary Light, border-top coral):
"3 selected" | [Export selected] [Update status ▾]
PAGINATION (p 16px, border-top):
Left: "Showing 1-20 of 247 orders"
Center: [← Prev] [1] [2] [3] ... [13] [Next →]
Right: "Rows per page: 20 ▾"
━━━ [ARTBOARD 3: ORDER DETAIL DRAWER] ━━━━━━━━━━━━━━━━━━
Show the Orders List artboard as bg, dimmed with overlay.
Drawer slides in from right: 480px wide, full-height, white bg, Modal shadow.
DRAWER:
HEADER (p 20px, border-bottom):
"Order #MC-04521" H4 left  +  "Shipped" badge  +  ✕ close right
"Sarah Johnson · Jun 3, 2024 · $55.98" caption muted
BODY (p 20px, scrollable):
STATUS TIMELINE (vertical, mb 24px):
  H5 "Order Timeline"
  5 steps (vertical, 32px circle, coral line):
    ✅ Confirmed — Jun 1, 2:14 PM
    ✅ In Production — Jun 2, 9:00 AM
    ✅ Shipped — Jun 3, 11:32 AM  ← current, coral pulse
    ○ Delivered — Est. Jun 5–10
    ○ Completed

ITEMS (mb 24px):
  H5 "Items (2)"
  Item rows (dividers):
    [thumbnail 56px] + name + customization summary + qty + price right
    Item 1: Custom Mug · Qty 2 · $55.98
      Customization: "Names: John & Sarah · Style: Watercolor"
      [👁 View customization] small link

CUSTOMER (mb 24px, pt 16px border-top):
  H5 "Customer"
  "Sarah Johnson"  "sarah@email.com"  "+1 555 0100"
  [View Customer Profile →] link

SHIPPING (mb 24px, pt 16px border-top):
  H5 "Shipping"
  Address block
  Method: "Express Shipping — FedEx"
  TRACKING (mt 12px):
    Label "Tracking Number"
    Inline: [carrier dropdown FedEx ▾]  [tracking # input]  [Save] Primary SM
    "794644792798" filled example

UPDATE STATUS (mb 24px, pt 16px border-top):
  H5 "Update Order Status"
  [Status dropdown: Shipped ▾] full-width
  "Add note (optional)" textarea 60px
  [Update Status] Primary MD full-width (mt 12px)
FOOTER (p 20px, border-top, bg #F9FAFB):
[💰 Issue Refund] Destructive SM  +  [📧 Email Customer] Ghost SM
═══════════════════════════════════════════════════════════
💡  TIPS SỬ DỤNG FIGMA MAKE HIỆU QUẢ
═══════════════════════════════════════════════════════════
THỨ TỰ CHẠY:

Prompt 00 → tạo Design System (Color/Text Styles + Components)
Prompt 01 → Homepage (desktop + mobile) → chuẩn hóa layout chung
Prompt 02 → Product Listing
Prompt 03 → Product Detail (phức tạp nhất, cần component từ 01+02)
Prompt 05–07 → Cart → Checkout → Success/Tracking
Prompt 08–09 → Account + Auth
Prompt 10 → Admin
(Prompt 04 — Mobile Customizer — đã tích hợp vào Prompt 03 mobile)

NẾU MAKE BỊ TIMEOUT:
Mỗi prompt đã chia theo SECTION, paste từng section một:
e.g. Prompt 03 desktop: chỉ paste phần LEFT COLUMN trước → generate → paste RIGHT COLUMN
SAU KHI GENERATE XONG MỖI TRANG:
Chọn component lặp lại (ProductCard, Navbar, Footer...) → Figma "Create Component" → reuse
TINH CHỈNH SAU KHI GENERATE:
"Make the hero headline larger and more impactful"
"Increase whitespace between sections by 50%"
"Make all product card images taller (4:5 ratio)"
"Add a sticky add-to-cart bar at the bottom of mobile product detail"
"Make the admin sidebar items have more padding"