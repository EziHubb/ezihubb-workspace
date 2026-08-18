# Etsy UI Audit — Phase 0 Inventory

Status: IN PROGRESS. Every image opened directly (no filename guessing). Updated incrementally as each image is reviewed — this file is the single source of truth if the session is interrupted.

Total files found by `find etsy-assets -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \)`: **63**
Processed so far: **63** (Phase 0 COMPLETE — see summary at bottom)

## Legend
- **State**: default / hover / empty / loading / error / open-modal / open-dropdown / validation
- **Scroll-of**: if this image is a scrolled continuation of another image in the same folder, names it
- **Route**: best-guess repo route/component (unconfirmed until Gap Audit phase)
- **Status**: `pending` (not yet gap-audited) — Phase 0 only inventories, does not fix

| # | File | Folder | Screen | State | Breakpoint | Scroll-of | Route (repo) | Status |
|---|------|--------|--------|-------|-----------|-----------|---------------|--------|
| 1 | photo_13_2026-08-15_09-09-51.jpg | Customer service stats | Customer service stats — full page (Welcome future Star Seller banner, 4 badge progress icons, "Track your daily progress" 4-stat-card grid, "Review Etsy's customer service standards" accordion, "Tools and tips" 3-card row, FAQ accordion w/ left nav) | default, all stats empty (dashes, "0 cases") | desktop | — | `apps/admin/.../customer-service-stats` (NOT YET IMPLEMENTED per project memory) | pending |
| 2 | photo_9_2026-08-15_09-09-51.jpg | Etsy search visibility | Search visibility — full page ("1 factor risks lowering..." banner, "Your listings" risk card w/ "Update titles" CTA, "Here's where you're right on track" 2 checked items, "Bonus tips" 3-card row) | default | desktop | — | `apps/admin/.../search-visibility` (NOT YET IMPLEMENTED per project memory) | pending |
| 3 | photo_1_2026-08-15_09-09-51.jpg | dashboard | Dashboard Home tab (greeting header, risk banner, "Customise your shop" 3/5 checklist, "Top tasks" 3-card row, "Stats" 4-metric row w/ date-range picker, "Shop advisor" empty state, "Resources" card) | default | desktop | — | `apps/admin/.../dashboard/page.tsx` | **DONE — see Phase 1 log below** |
| 4 | photo_2_2026-08-15_09-09-51.jpg | dashboard | Dashboard "Recent activity" tab (filter pills: All/Purchases/Reviews/Item favourites/Shop favourites, activity feed item w/ thumbnail, "Show more" button) | default | desktop | — | `apps/admin/.../dashboard/page.tsx` | **DONE (UI shell only, see log) — see Phase 1 log below** |
| 5 | photo_3_2026-08-15_09-35-33.jpg | delivery settings | Upgrades tab (Delivery upgrades heading, copy, Enabled/Disabled radio) | default | desktop | — | `settings/delivery/page.tsx` `UpgradesTab` | pending |
| 6 | photo_4_2026-08-15_09-35-33.jpg | delivery settings | "Order processing schedule" edit — CENTERED MODAL over profiles tab (Mon-Fri locked checkbox + Sat/Sun checkboxes, Cancel/Update) | open-modal | desktop | — | `OrderProcessingScheduleModal.tsx` | pending |
| 7 | photo_5_2026-08-15_09-35-33.jpg | delivery settings | "Create processing profile" — FULL PAGE (not modal), breadcrumb "← Back to Delivery profiles & processing", 2 large bordered radio-cards (Made to order / Ready to dispatch), processing-time SELECT dropdown open showing presets (1 day/1-2/1-3/3-5/5-7/Custom range) | default, dropdown-open | desktop | — | `ProcessingProfileModal.tsx` **(currently a MODAL in code, Etsy uses a dedicated page)** | pending |
| 8 | photo_6_2026-08-15_09-35-33.jpg | delivery settings | "Delivery profiles & processing" tab, scrolled to show full "Your processing profiles" (2 rows, one shows "Applied to 0 active listings. Go to listings ↗" link-style copy when count=0) + top of "Delivery profiles" table w/ green "Your profile has been created!" toast (bottom-right, dismissible) | default + success-toast | desktop | continuation of photo_6 relative to photo_2(main tab) — same tab, further scroll/state | `settings/delivery/page.tsx` + toast system | pending |
| 9 | photo_7_2026-08-15_09-35-33.jpg | delivery settings | "Edit processing profile" — FULL PAGE, same layout as Create but pre-filled (Made to order selected, "Custom range" 6–10 Days/Weeks toggle), "15 active listings will be updated" + listing preview rows | default | desktop | — | `ProcessingProfileModal.tsx` | pending |
| 10 | photo_8_2026-08-15_09-35-33.jpg | delivery settings | "Edit origin post code" — small ANCHORED POPOVER (not modal) opened from the Delivery profiles table header, showing postal-code input + Update button; table visible behind (checkbox col, Origin/Active listings columns populated: 85043 / 15, pencil+duplicate+trash icons, pagination ← 1 →) | open-popover | desktop | — | needs new `Popover` component (per earlier design-system plan) | pending |
| 11 | photo_9_2026-08-15_09-35-33.jpg | delivery settings | "Create delivery profile" — **CENTERED MODAL** (X close top-right), full form: origin country Select, origin postal code input, per-destination cards (Vietnam / Everywhere else) each with Delivery service Select + **Delivery time as TWO SELECT DROPDOWNS (not number inputs)** + "What you'll charge" Select (Free delivery listed BEFORE Fixed price), validation state shown (red "Select delivery time" + red-bordered selects), **"Delivery upgrades (Optional)" section entirely absent from current code**, Profile name input, Cancel/"Save profile" | validation-error | desktop | — | `DeliveryProfileModal.tsx` **currently uses `Drawer` (side slide-over) — Etsy uses a centered Modal** | pending |
| 12 | photo_10_2026-08-15_09-35-33.jpg | delivery settings | Same Create-profile modal, "What you'll charge" Select open showing dropdown options (Free delivery highlighted/selected in blue, Fixed price below in red/error color when a sibling row is invalid) | open-dropdown | desktop | continuation of #11 | `DeliveryProfileModal.tsx` | pending |

**Delivery settings folder: CORRECTED to 10/10 files (photo_1 and photo_2 with the 09-35-33 timestamp were initially missed — caught during final cross-check against `find` output). See rows 38-39 below.**

| 13 | photo_1_2026-08-15_09-31-28.jpg | finances | Payment account — main (Current/Pending/Total balance cards, "No funds ready for deposit" + "Nothing due for August" info cards, Activity summary w/ month picker, Sales/Fees/Marketing category rows, Recent activities table) | default, negative balance | desktop | — | `finances/page.tsx` (Payment account tab) | pending |
| 14 | photo_2_2026-08-15_09-31-28.jpg | finances | Activity summary "Expand categories" state — Sales/Fees 2-col detail cards (Listing fees, Transaction fees, Processing fees, Regulatory Operating fee, Deposit fees, VAT on seller fees, Share & Save Refund, One-time shop set-up fee + nested Credits row), Seller services/Marketing expanded (Etsy Ads, Offsite Ads) | default, categories-expanded | desktop | continuation of #13 | `finances/page.tsx` category expand UI | pending |
| 15 | photo_3_2026-08-15_09-31-28.jpg | finances | Recent activities — "Total balance" info tooltip/popover open (title + explainer paragraph + "Keep in mind" note + 3 "Learn more about" links) | tooltip-open | desktop | continuation of #13 | `finances/page.tsx` info tooltip | pending |
| 16 | photo_4_2026-08-15_09-31-28.jpg | finances | "Your current net profit" info tooltip/popover open (short 1-line explainer) over Sales/Fees cards | tooltip-open | desktop | continuation of #13/#14 | `finances/page.tsx` info tooltip | pending |
| 17 | photo_5_2026-08-15_09-31-28.jpg | finances | Monthly statement — full activity table (breadcrumb "Payment account > Monthly statements > Monthly statement", month/year pickers, "Generate CSV" button, VAT/Fee rows w/ thumbnail+listing link, pagination "1 2") | default | desktop | — | `finances/page.tsx` (Monthly statements tab) | pending |
| 18 | photo_6_2026-08-15_09-31-28.jpg | finances | Payment settings — Payment Methods tab (Etsy Payments blurb, Bank details card w/ masked account + Edit button, Deposit schedule select) | default | desktop | — | `finances/page.tsx` (Payment settings tab) | pending |
| 19 | photo_7_2026-08-15_09-31-28.jpg | finances | Payment settings — Currency tab, full page (shop listing currency USD banner, "Looking to change" accordion expanded, full country/currency picker grid 3-col, Price Conversion Preference radio + Example Price Conversion card, "Change Shop Currency" button) | default, accordion-expanded | desktop | — | `finances/page.tsx` (Payment settings > Currency) | pending |
| 20 | photo_8_2026-08-15_09-31-28.jpg | finances | Same Currency tab, zoomed/scrolled to top (tabs row + "Your shop listing currency is USD" banner + collapsed accordion) | default, accordion-collapsed | desktop | scroll/zoom-of #19 | `finances/page.tsx` (Payment settings > Currency) | pending |
| 21 | photo_9_2026-08-15_09-31-28.jpg | finances | Payment settings — Billing tab ("Your billing cards" table: Default radio, Card type & number masked, Expiration, Cardholder name, Edit button; "+ Add a new card"; Autobilling toggle ON) | default | desktop | — | `finances/page.tsx` (Payment settings > Billing) | pending |
| 22 | photo_10_2026-08-15_09-31-28.jpg | finances | Payment settings — Address tab ("Taxpayer address" block w/ full name/street/city/province/country, "Edit legal shop information" button) | default | desktop | — | `finances/page.tsx` (Payment settings > Address) | pending |
| 23 | photo_11_2026-08-15_09-31-28.jpg | finances | Legal and tax information — "Edit legal shop information" full page (seller-type radio Individual/Incorporated, ERC number readonly block: Full legal name/Taxpayer ID/Date of birth + Edit, "Primary owner's contact information" form: Country select, Street address, Flat/Other, City, Province select + Post code, Phone number, "Submit to Etsy" button) | default | desktop | — | `finances/page.tsx` (Legal and tax information tab) — **NOTE: contains real PII (bank acct, phone, address, taxpayer ID) — do not echo raw values outside this audit** | pending |
| 24 | photo_3_2026-08-15_09-09-51.jpg | listing | Listings grid — full page (search bar, bulk action pills Renew/Deactivate/Delete/Editing options, 15-item photo grid w/ Video badge, price range, stock, auto-renew date, star/gear icons per card; right rail: Stats toggle, Sort, Listing status radio list w/ counts, Sections/Delivery profiles/Return policies/Production partners filters, Listing videos filter, Tags filter) | default | desktop | — | `listings/page.tsx` | pending |
| 25 | photo_4_2026-08-15_09-09-51.jpg | listing | Listings grid, 1 item selected — "Editing options" dropdown open (Edit titles/tags/descriptions/prices, Change custom options/production partners/processing profile/delivery profiles/return & exchange policies, scroll for more) | open-dropdown, 1-selected | desktop | continuation of #24 | `listings/page.tsx` bulk-edit menu | pending |
| 26 | photo_5_2026-08-15_09-09-51.jpg | listing | "Editing tags for 1 listing" — CENTERED MODAL (Add/Remove select, tag input w/ placeholder "Shape, colour, style, function, etc.", current-tags chip list read-only preview, Cancel/Apply) | open-modal | desktop | continuation of #24/#25 | needs `BulkEditTagsModal` (not yet found in repo — verify in gap-audit) | pending |
| 27 | photo_6_2026-08-15_09-09-51.jpg | listing | "Editing title for 1 listing" — CENTERED MODAL (Add to front/end / Find and replace / Delete / Reset title select open, text input, current-title preview, Cancel/Apply) | open-modal, open-dropdown | desktop | continuation of #24/#25 | needs `BulkEditTitleModal` (not yet found in repo — verify in gap-audit) | pending |
| 28 | edit_store_page.png | (root) | Shop Home editor — full page (Colour theme button, hero banner image w/ edit-overlay icon, shop logo+name+tagline+location w/ Edit links, avatar, Items search + filter tabs All/On sale/Christmas Ornament 2026, "+ Featured area to highlight listings", 4-col item grid w/ sale-price strikethrough, Sort, "0 Sales"/"0 Admirers", Announcement block, About section w/ Add-video/Add-photos/Add-headline/Add-story/Add-links prompts, Shop members, Shop policies CTA banner, FAQ prompt, Seller details/EU status) | default, empty-state prompts | desktop | — | `settings/store` or `shop-home` editor (route TBD — verify in gap-audit) | pending |
| 29 | listing_detail_page.png | (root) | Listing editor — full page, all tabs visible via scroll (top tab bar Performance/Photo & Video/Item details/Item options/Pricing & Delivery/How It's Made/Settings; photo grid w/ 8 thumbnails + add-video tile + "Adjust thumbnails"; Item details: category/title w/ AI suggestion pill + tips checklist/description/attributes tags+materials+colour+dimensions; Item options: Shape select, per-option price+visibility toggle rows, Custom options personalization row; Attributes "Show all attributes"; Price and inventory: Price/Quantity/Add SKU; Delivery/processing/returns: Processing profile+Delivery option rows w/ Change buttons, Preview postage cost, Returns policy; GDPR/manufacturer info; "How it's made" full radio tree (Who made it/What is it/production process/tools used); Production partners; Settings: Shop section select, Feature toggle, Renewal options radio, Preview/Publish buttons, "You have no unsaved changes" footer) | default | desktop, full-scroll composite | — | product editor `apps/admin/.../products/[id]/edit` | **DONE — full a→d pipeline run, see verification table below** |
| 30 | marketing/photo_15_2026-08-15_09-09-51.jpg | marketing (root) | Offsite Ads — full dashboard page (blurb, date-range picker, Performance driven by your ads 5-stat row, Indirect ad traffic 4-stat row, "Ad traffic over time" line chart w/ hover tooltip spike, List view toggle + Compare-to-previous checkbox, Ad performance by channel table, Ad performance by listing table w/ thumbnails, "Thinking about opting out?" card w/ toggle ON) | default | desktop | — | `apps/admin/.../marketing/offsite-ads` (per memory: reference captured, not yet implemented) | pending |
| 31 | marketing/photo_18_2026-08-15_09-09-51.jpg | marketing (root) | Social media — landing page (peach hero band "Recommended post: Share your promotion" w/ 3 chat-bubble icons + preview card w/ Share overlay, "+ Create post" button top-right, "My newest listings" 5-thumbnail row, "Sales or promotions" row: 3 sale-badge preview cards + "+ Create offer" tile) | default, empty-history | desktop | — | `apps/admin/.../marketing/social-media` (per memory: reference captured, not yet implemented) | pending |
| 32 | messages/photo_7_2026-08-15_09-09-51.jpg | messages | Messages — empty inbox (left folder list: Inbox/Starred/From potential buyers/From Etsy/Sent/All/Unread/Spam/Recycling bin; top toolbar: bulk-select checkbox/Recycling bin/Mark Unread/Mark Read/Report/Archive/Label dropdown; center illustration + "No conversations to see here!") | empty-state | desktop | — | `apps/admin/.../messages/page.tsx` | pending |
| 33 | orders/photo_8_2026-08-15_09-09-51.jpg | orders | Orders — empty state (bulk-select+Complete order+More actions toolbar, New/Completed tabs "New 0", "20 orders per page" select, box illustration + "No orders here right now", "Are your processing times accurate?" tip card w/ thumbs up/down, right filter rail: Dispatch by date radios, Destination radios incl. Vietnam, Order details checkboxes, Delivery "Upgrade requested" checkbox, Reset filters) | empty-state | desktop | — | `apps/admin/.../orders/page.tsx` | pending |
| 34 | policy vaiolations/photo_14_2026-08-15_09-09-51.jpg | policy vaiolations | Policy violations — clean/no-violations state (scroll icon illustration + "All clear so far – keep it up!", "Get to know our policies" 3-card row: Ultimate Guide to Etsy Policy / Creativity Standards Policy / 4 Best Practices for Listings, each w/ image+title+desc+button) | empty-state | desktop | — | `apps/admin/.../policy-violations/page.tsx` | pending |
| 35 | stats/photo_10_2026-08-15_09-09-51.jpg | stats | Shop traffic — full page (date-range picker + "9 hours ago" refresh note, Visits/Orders/Conversion rate/Revenue 4-stat row, line chart w/ hover tooltip "08 Aug 2026: 5 visits", Shopper Stats collapsible 6-card grid: Item favourites/Shop follows/Reviews/Repeat buyers/Cities reached/Abandoned baskets each w/ CTA link, "Is this helpful?" feedback, "How shoppers found you" 2-col Etsy-brought-70%/You-brought-29% breakdown w/ sub-source links, Share & Save trackable-link card, Offsite Ads traffic card, "Shoppers viewed your listings 100 times" table w/ thumbnails+Views/Favourites/Orders/Revenue cols + pagination) | default | desktop | — | `apps/admin/.../stats/page.tsx` (Shop traffic tab) | pending |
| 36 | stats/photo_11_2026-08-15_09-09-51.jpg | stats | Same Shop traffic page, "Conversion rate" stat tab ACTIVE (blue-bordered box + underline), chart re-rendered as flat 0% line for that metric | default, tab-active | desktop | continuation of #35 (metric-tab switch) | `apps/admin/.../stats/page.tsx` metric-tab chart | pending |
| 37 | stats/photo_12_2026-08-15_09-09-51.jpg | stats | Marketplace Insights — full page ("14 remaining" search-credit badge, How-to link, dismissible banner "More insights to learn how buyers search", "Explore search terms related to your shop" search input, Saved searches empty-state card, "What buyers are searching for across Etsy" category pill row + 4 trending-term image cards w/ volume counts) | default | desktop | — | `apps/admin/.../stats/page.tsx` (Marketplace insights tab) — likely NOT YET IMPLEMENTED, verify in gap-audit | pending |

**finances 11/11, listing 4/4, root PNGs 2/2, marketing-root 2/2, messages 1/1, orders 1/1, policy vaiolations 1/1, stats 3/3 — all processed.**

| 38 | delivery settings/photo_1_2026-08-15_09-35-33.jpg | delivery settings | **MISFILED — content is identical to finances/photo_11 (Legal and tax info edit page).** Not a delivery-settings screen at all; almost certainly a screenshot-tool numbering mistake. | default | desktop | duplicate of #23 (finances row) | n/a — no delivery-settings content here | pending |
| 39 | delivery settings/photo_2_2026-08-15_09-35-33.jpg | delivery settings | "Delivery settings" — main tab DEFAULT view (tab bar: Delivery profiles & processing / **US free delivery guarantee** / Upgrades; "Order processing schedule" card "Monday-Friday, Saturday, Sunday" + Edit; "Your processing profiles" card "Made to order (6-10 days), Applied to 15 active listings" + Create new; "Delivery profiles" table: bulk-checkbox col, "Edit origin post code" dropdown-button, Create profile button, 1 row "Ornament Shipping" Fixed badge / Origin 85043 / Active listings 15 / edit+**duplicate**+delete icons, pagination) | default | desktop | — | `settings/delivery/page.tsx` main tab — **confirms real Etsy tab name is "US free delivery guarantee", current code's "Delivery guarantee" tab name/framing is a mismatch (previously flagged); also confirms a duplicate-profile icon DOES exist in real Etsy despite no backend duplicate endpoint (see side-task notes)** | pending |
| 40 | sales and discounts/main tab.jpg | marketing (sales and discounts) | "Sales and discounts" — Promotions tab, full page ("Your key sales and discounts" table: Type/Discount/Offers granted/Purchases/Conversion rate/Revenue, 3 active shop-wide sales; "Send offers to interested buyers" 5-card grid: Interested shopper/Abandoned basket/Thank you/Favourited item/Promo code, each "Set up →"; "Drive traffic and move inventory" 2-card row: Accept offers from buyers/Run a sale; "Up your average order value" 2-card row: Set an order minimum/Bundle items together; "Join Etsy's next sales events" empty state) | default | desktop | — | `marketing/sales/page.tsx` | pending |
| 41 | sales and discounts/side tab.jpg | marketing (sales and discounts) | "Sales and discounts" — **Details & Stats tab** (mislabeled "side tab" in filename — verified by opening, it's the 2nd top tab, not a side panel) — "Individual sales and coupons" table: Offer/Duration/Offers granted/Uses/Revenue, This Month picker, 3 sale rows w/ Active badge + Details link | default | desktop | — | `marketing/sales/page.tsx` (Details & Stats tab) — verify exists in current code | pending |
| 42 | sales and discounts/promo code dialog.jpg | marketing (sales and discounts) | "Create a promo code" — CENTERED MODAL, periwinkle hero header (tag icon), form: Discount amount (type Select + % input), Order minimum radio (None/Number of items/Order total), Duration 2 date inputs + "No end date" checkbox, Redemption limit radio (No limit/Total number of offers/Single use per buyer, "NEW" badge), Custom promo code text input, Cancel/Continue | default | desktop | — | needs `PromoCodeModal` (verify exists in repo) | pending |
| 43 | sales and discounts/accept offer from buyer dialog.jpg | marketing (sales and discounts) | "Accept offers from buyers" setup — SPLIT-PANEL modal (left: periwinkle/blue illustration panel "Let buyers make offers to help clear out inventory" + 3-item checklist + "How it works" link; right: "Choose your settings" — Which listings radio (All my listings (15) / Specific listings), "What's the maximum discount you'll consider?" pill-button row 20%/30%/40%/"Receive all offers", Cancel/Save and apply) | default | desktop | — | needs `AcceptOffersModal` (verify exists in repo) | pending |
| 44 | sales and discounts/interested shopper offer dialog.jpg | marketing (sales and discounts) | "Set up targeted offers" — CENTERED MODAL, periwinkle hero header, 4 collapsible offer-type cards (Interested shopper/Thank you/Abandoned basket/Favourited item), "Interested shopper" card EXPANDED+checked: Discount amount (type+%), Promo code input, "+ Set an order minimum (optional)" expandable link, Cancel/"Create 1 offer" | default, card-expanded | desktop | — | `TargetedOffersModal` (shared component across rows 44-46, 48) — verify exists | pending |
| 45 | sales and discounts/abandoned basket offer dialog.jpg | marketing (sales and discounts) | Same "Set up targeted offers" modal, "Abandoned basket" card expanded+checked: Discount amount, Promo code, "Include abandoned baskets from the last 30 days" checkbox (checked) | default, card-expanded | desktop | continuation of #44 (same modal, different card) | `TargetedOffersModal` | pending |
| 46 | sales and discounts/favourited item offer dialog.jpg | marketing (sales and discounts) | Same modal, "Favourited item" card expanded+checked: Discount amount, Promo code (no extra checkbox for this type) | default, card-expanded | desktop | continuation of #44 | `TargetedOffersModal` | pending |
| 47 | sales and discounts/thank you offer dialog.jpg | marketing (sales and discounts) | Same modal, "Thank you" card expanded+checked: Discount amount, Promo code, "+ Set an order minimum (optional)" link, "Include customers from the last 90 days" checkbox (checked) | default, card-expanded | desktop | continuation of #44 | `TargetedOffersModal` | pending |
| 48 | sales and discounts/bundle item together dialog/photo_2026-08-15_09-28-26.jpg | marketing (bundle item together) | "Create an irresistible offer..." — SPLIT-PANEL intro (left periwinkle: skeleton preview card "Buy them together for X% off" + 2 placeholder rows + "Add all to basket" button; right: "Choose listings and set a discount" — 3 empty "+ Add listings" slots, "Set a discount amount" Select 5%) | default, empty | desktop | — | `BuyTogetherModal.tsx` (already rewritten this session — cross-check against this screen) | pending |
| 49 | sales and discounts/bundle item together dialog/photo_4_2026-08-15_09-26-23.jpg | marketing (bundle item together) | Listing picker grid screen — "Choose up to three of your listings", yellow warning banner "Looks like you're running a sale on one or more of these listings...", search + "Filter by section" All(15), 15-item checkbox grid, Cancel/Continue | default, warning-banner | desktop | continuation of #48 | `BundleListingPickerScreen` (already built this session) — **confirms sale-conflict warning banner is real and was a deliberate simplification omission — should be added** | pending |
| 50 | sales and discounts/bundle item together dialog/photo_5_2026-08-15_09-26-23.jpg | marketing (bundle item together) | Split-panel w/ 2 listings selected (thumbnails+title+price+trash icon in right "Add listing" 3rd slot empty), discount 5%, "Original value US$44.00" / "New total US$41.80" computed preview | default, 2-selected | desktop | continuation of #48/#49 | `BuyTogetherModal.tsx` main form — confirms live original/new-total price preview is required | pending |
| 51 | sales and discounts/bundle item together dialog/photo_6_2026-08-15_09-26-23.jpg | marketing (bundle item together) | "Success! Your offer is live." confirmation screen — 2 listing thumbnails, "Buyers will get 5% off these items when they buy them together!", "Go to Details & Stats to manage..." link, Done button | success | desktop | continuation of #48-50 | `BuyTogetherModal.tsx` success screen (already built) | pending |
| 52 | sales and discounts/set an order minimum dialog/photo_1_2026-08-15_09-26-23.jpg | marketing (set an order minimum) | "Here's how discounts with order minimums work" — explainer/intro screen w/ live PRODUCT-CARD preview widget (image, price, title, seller name+rating, "Save 10% when you buy 2 items at this shop" badge, Buy it now/Add to basket buttons, Klarna instalment note, Add to collection), Cancel/Next | default | desktop | — | `OrderMinimumModal.tsx` intro screen (already built this session) | pending |
| 53 | sales and discounts/set an order minimum dialog/photo_3_2026-08-15_09-26-23.jpg | marketing (set an order minimum) | "Create your discount" — actual form, periwinkle hero header: Discount amount Select 25%, Order minimum radio (Number of items/Order total), Start and end dates (2 date inputs, pre-filled), "Where is the offer valid?" Select "Everywhere", Cancel/Create discount | default | desktop | continuation of #52 | `OrderMinimumModal.tsx` form screen (already built) | pending |
| 54 | sales and discounts/run a sale dialog/photo_2_2026-08-15_09-23-54.jpg | marketing (run a sale) | "Set up a sale" — Step 1 "Customise your sale": Discount amount (type Select "Percentage off" + number Select 25) w/ "Sellers that offered at least 25% off received more orders..." helper note, "Where is this offer valid?" Select "Everywhere", "Sale duration" 2 date inputs "up to 30 days", "Terms and conditions (if applicable)" textarea 500-char counter, "Sale name" text input "Ex. SPRINGSALE", Cancel/Continue | default | desktop | — | `RunSaleModal` / `settings-discounts` flow — verify exists in repo | pending |
| 55 | sales and discounts/run a sale dialog/photo_3_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same step 1, "Discount amount" type-Select open: "Select discount type" / "Free standard delivery" (highlighted) / "Percentage off" | open-dropdown | desktop | continuation of #54 | `RunSaleModal` — **confirms "Free standard delivery" is a real discount-type option, not just percentage/fixed** | pending |
| 56 | sales and discounts/run a sale dialog/photo_4_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same step 1, "%" number-Select open: 25(highlighted)/30/35/40/45/50/Custom | open-dropdown | desktop | continuation of #54 | `RunSaleModal` | pending |
| 57 | sales and discounts/run a sale dialog/photo_5_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same step 1, "Where is this offer valid?" country-Select open — full alphabetical country list (Everywhere highlighted at top, then Afghanistan...Bahamas visible, scrollbar) | open-dropdown | desktop | continuation of #54 | `RunSaleModal` | pending |
| 58 | sales and discounts/run a sale dialog/photo_6_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same step 1, Sale-duration START date-picker open — native calendar widget (Vietnamese locale "Tháng Tám 2026", day headers H/B/T/N/S/B/C, 15 Aug selected/highlighted blue, "Xóa"/"Hôm nay" links) | open-datepicker | desktop | continuation of #54 | `RunSaleModal` — native `<input type=date>`-style calendar, locale-aware | pending |
| 59 | sales and discounts/run a sale dialog/photo_7_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same, END date-picker open, same calendar widget | open-datepicker | desktop | continuation of #54/#58 | `RunSaleModal` | pending |
| 60 | sales and discounts/run a sale dialog/photo_8_2026-08-15_09-23-54.jpg | marketing (run a sale) | Step 2 "Which listings are included in your sale?" — 2 large radio-cards: All listings (shop-wide, selected default) / Select listings, Go back/Review and confirm | default | desktop | continuation of #54 (step 2) | `RunSaleModal` step 2 — **confirms this is a multi-step wizard (URL shows `/me/sales-discounts/step/createSale`, visible in browser chrome behind the modal in #57), not a single-screen dialog** | pending |
| 61 | sales and discounts/run a sale dialog/photo_9_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same step 2, "Select listings" radio chosen: "Choose which listings to include (0 selected)", "Add listings by shop section" dropdown open (Christmas Ornament 2026 (15) / No Section (0)), search input, "Add some listings to get started" empty state | default, dropdown-open | desktop | continuation of #60 | `RunSaleModal` step 2 listing picker | pending |
| 62 | sales and discounts/run a sale dialog/photo_10_2026-08-15_09-23-54.jpg | marketing (run a sale) | Same step 2, 15 listings selected via "Christmas Ornament 2026" section — full row list w/ thumbnail/title/price-range/stock/remove-X, Go back/Review and confirm | default, 15-selected | desktop | continuation of #60/#61 | `RunSaleModal` step 2 | pending |
| 63 | sales and discounts/run a sale dialog/photo_11_2026-08-15_09-23-54.jpg | marketing (run a sale) | Step 3 "Review your sale details" — summary table (Discount 25% off / Duration 15 Aug-15 Aug / Included listings "Whole shop" / Sale name BLASTOPENSALE44 / Terms None), "subject to Etsy's Advertising & Marketing Policy" link, Go back/"Confirm and create s..." | default | desktop | continuation of #54/#60 (step 3) | `RunSaleModal` step 3 review — confirms 3-step wizard: customize → choose listings → review | pending |

---

## Phase 0 Summary (COMPLETE)

**Total images found by `find`:** 63
**Total images opened and catalogued:** 63 (63/63 — verified by direct cross-check of every path returned by `find` against every row in this table; 2 initially-missed `delivery settings` files caught and added as rows 38-39)

**Per-folder counts (found vs. processed):**
| Folder | Found | Processed |
|---|---|---|
| Customer service stats | 1 | 1 |
| Etsy search visibility | 1 | 1 |
| dashboard | 2 | 2 |
| delivery settings | 10 | 10 |
| finances | 11 | 11 |
| listing | 4 | 4 |
| marketing (root) | 2 | 2 |
| marketing/sales and discounts | 24 | 24 |
| messages | 1 | 1 |
| orders | 1 | 1 |
| policy vaiolations | 1 | 1 |
| stats | 3 | 3 |
| root (edit_store_page.png, listing_detail_page.png) | 2 | 2 |
| **TOTAL** | **63** | **63** |

**Unique screens/components identified (approx.):** ~34 distinct screens/dialogs, several captured in multiple states (default/hover/open-dropdown/open-modal/validation/success) — e.g. `RunSaleModal` alone spans a 3-step wizard across 10 images; `TargetedOffersModal` is 1 shared component shown 4× with a different card expanded each time; `DeliveryProfileModal` and `BuyTogetherModal`/`OrderMinimumModal` were already identified as gaps earlier this session.

**Images that could not be confidently mapped to an existing repo route (need confirmation during gap-audit, not blocking):**
- row 42 `PromoCodeModal`, row 43 `AcceptOffersModal`, row 44-47 `TargetedOffersModal`, row 54-63 `RunSaleModal` — none of these 4 flows were located in the codebase during this pass (Phase 0 is read-only/no-code per the rules, so no `grep` was run yet); need to confirm in Phase 1 (marketing module) whether they exist under different names, are partially implemented, or are entirely missing.
- row 41 Details & Stats tab — same, unconfirmed.

**Repo modules with ZERO screenshot coverage** (i.e., modules that exist or might exist in the repo but have no corresponding image in `etsy-assets/`, OR are covered by screenshots but the underlying repo route couldn't be confirmed to exist without a code search): none identified from the image side — every folder in `etsy-assets/` maps to a plausible Shop-Manager-parity module. The inverse question (repo routes with no screenshot) is out of scope for Phase 0 (which only inventories images) and will be assessed per-module during each Phase 1..N gap-audit step.

**Notable structural findings surfaced during Phase 0 (NOT yet acted on — recorded for the Phase 1 gap-audit):**
1. `DeliveryProfileModal.tsx` currently renders as a `Drawer`; real Etsy uses a centered `Modal`. Delivery-time fields are number `<input>`s; real Etsy uses `Select` dropdowns. An entire "Delivery upgrades (Optional)" section is missing from current code.
2. `ProcessingProfileModal.tsx` currently renders as a modal; real Etsy uses a dedicated full page with a `← Back to Delivery profiles & processing` breadcrumb.
3. "Edit origin post code" needs a small anchored `Popover` component that doesn't exist yet in `libs/ui`.
4. Delivery settings tab is currently labeled "Delivery guarantee" in code; real Etsy labels it "US free delivery guarantee" (confirmed twice now, rows 21/39).
5. The Delivery profiles table row in real Etsy has edit + **duplicate** + delete icons; current code was deliberately built without a duplicate icon (no backend duplicate endpoint) — this is a real, confirmed gap, not a hypothetical one.
6. `BuyTogetherModal.tsx`/`OrderMinimumModal.tsx` (already rewritten this session, uncommitted) structurally match the real screenshots closely (split-panel intro, picker grid, price-preview, success screen for Buy Together; explainer+preview-widget then form for Order Minimum) — but `BuyTogetherModal.tsx`'s picker screen is missing the yellow "already running a sale" conflict-warning banner seen in row 49, which was called out as a known simplification when it was built.
7. `marketing/sales/page.tsx`'s 5+2+2-card "Sales and discounts" hub (row 40) needs verification against current code for the exact card set, icons, and copy.
8. Four dialogs (Promo code, Accept offers from buyers, Set up targeted offers, Run a sale/3-step wizard) have no confirmed corresponding component in the repo yet — likely all-new builds, to be confirmed via `grep` at the start of the marketing Phase 1 pass.
9. "Run a sale" is a **3-step URL-addressable wizard** (`/me/sales-discounts/step/createSale`), not a single-screen modal — this is a bigger structural gap than a simple visual mismatch if current code (if any) implements it as one screen.

**Things that will need the user's own eyes later (Phase 1+), not verifiable from static screenshots:** hover states, focus-ring styling, open/close transition/animation timing for modals and dropdowns, toast enter/exit animation, any drag interactions, exact scroll-shadow behavior on long modals (e.g. `TargetedOffersModal`'s scrollable card list, visible scrollbar in rows 44-47).

---

**PHASE 0 COMPLETE.** User approved starting Phase 1 on 2026-08-18, with direction: for parts of a module with no backing data/business-logic in the repo, build the correct UI shell with an honest empty-state rather than fabricating numbers.

---

## Phase 1 — dashboard (DONE)

**Gap-audit (rows 3-4 vs. `apps/admin/src/app/(admin)/dashboard/page.tsx` before this pass):**
- `[thiếu hẳn]` No "Good morning/afternoon/evening, {shop}" greeting header — page used the generic `AdminPageHeader` title/subtitle for every role.
- `[thiếu hẳn]` No Home / Recent activity tabs at all.
- `[lệch]` Risk banner copy: code said "Improving photos, listing info, and more can help how you show up in search."; real Etsy says "We found some ways you can optimise your listings and shop to help how you show up in search."
- `[thiếu hẳn]` Risk banner missing the "Not now" dismiss button (code only had "View search visibility").
- `[thiếu hẳn]` Missing "Top tasks show activity from the last 30 days." caption under the Top tasks cards.
- `[lệch]` "Stats" — real Etsy shows a compact Date-range + Total Views/Visits/Orders/Revenue row directly on Home; code instead showed 4 `StatCard`s (Revenue/Orders/Awaiting/In Production) followed by a full Revenue chart, Orders donut, Top Products table, and Pending Reviews card — none of which exist on Etsy's Home tab.
- `[thiếu hẳn]` No "Shop advisor" section.
- `[lệch]` "SEO Health" section rendered unconditionally at the bottom — not part of Etsy's Home tab; real Etsy funnels this through the risk banner → `/search-visibility` instead.

**Implemented (files changed):**
- `apps/api/src/modules/admin/dto/dashboard.dto.ts`, `apps/api/src/modules/admin/admin.service.ts` — additive-only: `ShopHealthDto`/`getShopHealth()` now also return `shopName`, `shopSlug`, `shopLogoUrl`, `activeListings` — all values the query already fetched but previously discarded after computing the checklist booleans. No new query, no new business rule.
- `apps/admin/src/components/dashboard/ShopOwnerHome.tsx` (new, client component) — greeting header (time-of-day + shop name/logo + active-listing count + storefront link), Home/Recent activity tabs, risk banner (correct copy + dismissible "Not now"), checklist (unchanged logic, moved here), Top tasks (+ caption), Stats row, Shop advisor empty-state, Recent-activity tab (filter pills + honest "No recent activity to show yet." — **no backing data source exists for a buyer-activity feed**, so this is a UI shell, not wired to real events).
- `apps/admin/src/app/(admin)/dashboard/page.tsx` — shop-owner branch now renders `<ShopOwnerHome>`; `AdminPageHeader` now only renders for SUPER_ADMIN; Revenue KPI cards / Revenue chart / Orders donut / Top Products / Pending Reviews / SEO Health are now `!isShopOwner`-gated (moved off the shop-owner Home tab, kept fully intact for the SUPER_ADMIN platform view — no data-fetching or components deleted).

**Deliberately left as honest gaps (no fabricated data), per user's approved direction:**
- Stats row's "Total Views" and "Visits" show "—" / "Not tracked yet" — no page-view or shop-visit analytics exist in the backend at all (would require a new tracking pipeline, out of scope for a UI pass).
- Recent-activity tab shows a real empty state, not fake buyer-activity events — no per-listing favourite/purchase/review event feed exists for shop owners (the existing `DASHBOARD_ACTIVITY` endpoint is a *different*, SUPER_ADMIN-only platform feed — STORE_APPROVED/CONTENT_FLAGGED/etc. — not reusable here).
- "Resources" section (Etsy shows seasonal marketing tips like "Get ready for pet shopping trends") was **not built** — there's no CMS/content feed to back it, and inventing fake tip copy would be worse than omitting it. Flagged here for a future content-source decision.
- Messages Top-task card still shows only 1 line ("N help requests"); real Etsy shows a 2nd line ("N potential buyers reaching out") with no equivalent tracked signal in this codebase — left as-is rather than guessing.

**Verify:** `pnpm nx run api:build` ✅ clean. `pnpm nx run admin:lint` ✅ 0 errors (62 pre-existing warnings elsewhere, unrelated). `pnpm nx run admin:build` — all routes compiled successfully including `/dashboard` (webpack/tsc passed); the run then failed at a later Windows-only step ("A required privilege is not held by the client", os error 1314 — a known Windows symlink-permission issue with Next's standalone-output post-processing, unrelated to this change). **Not visually verified in a live browser** — no browser-automation tool is available in this environment and local NextAuth isn't configured for login (documented earlier this session); this needs the user's own eyes, especially: tab-switch transition, "Not now" dismiss animation, greeting header on an actual logged-in shop-owner session, and real logo image rendering.

**Side finding:** the admin build's route list confirms `/search-visibility`, `/stats`, `/customer-service-stats`, `/marketing/social`, `/marketing/offsite-ads`, `/marketing/share-save` **already exist as implemented routes** — this corrects Phase 0's tentative "NOT YET IMPLEMENTED" notes on rows 1, 2, 30, 31, 37 (Customer service stats / Etsy search visibility / Offsite Ads / Social media / Marketplace insights). Those will get a real gap-audit instead of a from-scratch build when their turn comes.

---

---

## Phase 1 — listing (DONE)

**Gap-audit (rows 24-27 vs. `apps/admin/src/app/(admin)/products/page.tsx` before this pass):**
- `[lệch]` Page title "Products" vs real "Listings"; search placeholder "Search products…" vs real "Search by title, tag, or SKU"; button label "Add Product" vs real "Add a listing".
- `[lệch]` Bulk-action bar only rendered when `selectedIds.length > 0`; real Etsy shows a persistent pill toolbar (Renew/Deactivate/Delete/Editing options) always visible, disabled-looking until something is selected.
- `[thiếu hẳn]` No "Editing options" dropdown at all — real Etsy's dropdown has 9 items (titles/tags/descriptions/prices/custom options/production partners/processing profile/delivery profiles/return policies); backend only ever supported 4 bulk actions (publish/unpublish/archive/set-sale), none of them text-editing.
- `[thiếu hẳn]` "Editing tags for N listings" and "Editing title for N listings" centered modals (rows 26-27) — did not exist in any form.
- `[thiếu hẳn]` Right-sidebar filters: Sections / Delivery profiles / Return & exchange policies / Production partners / Listing videos / Tags, and a "Stats" per-card toggle — none exist; would need new query params + lookup-list endpoints on the products list API.

**Implemented (user approved the small additive backend piece for tags/title):**
- `apps/api/src/modules/products/products.service.ts` — new `bulkEditTags(productIds, mode, tagName)` (reuses the existing `resolveTagNames` upsert-by-slug helper the single-product editor already uses; add = `productTag.upsert`, remove = look up tag by slug + `deleteMany`) and `bulkEditTitle(productIds, mode, text, findText)` (add-to-front / add-to-end / find-replace / delete — plain string ops over `product.name`). Etsy's 5th mode, "Reset title", was **not implemented** — this catalog doesn't persist an "original" title separate from the live one, so there's nothing honest to reset to.
- `apps/api/src/modules/products/admin-products.controller.ts` — `BulkProductActionDto.action` now allows `'edit-tags' | 'edit-title'`; two new `switch` cases validate `payload` and call the new service methods. Same ownership-scoping/audit-log path as the existing 4 actions — no guard changes.
- `apps/admin/src/app/(admin)/products/page.tsx` — bulk bar rewritten as an always-visible pill row (Publish/Unpublish/Archive/Editing options/Set sale/Export), each `disabled` (not hidden) when nothing is selected; new "Editing options" dropdown with **only** "Edit titles" and "Edit tags" (the 7 items with no backing API — descriptions/prices/custom options/production partners/processing profile/delivery profiles/return policies — are commented out with a note, not rendered as dead menu items); two new `Modal` dialogs ("Editing tags for N listings", "Editing title for N listings") wired to the new bulk actions; header title → "Listings"; search placeholder → "Search by title, tag, or SKU"; Add-button label → "Add a listing".

**Deliberately left as gaps (need a separate decision, not built this pass):**
- Right-sidebar Sections/Delivery profiles/Return policies/Production partners/Listing videos/Tags filters, and the per-card "Stats" toggle — all need new list-query params and (for the dropdown filters) new lookup-list endpoints; out of scope for this pass per the "no bigger backend surface without asking" boundary.
- Card footer shows "N sold" instead of real Etsy's "Auto-renews {date}" — `ProductCard.tsx` has no listing-renewal-date concept; left unchanged (cosmetic, low priority, no functional impact).

**Verify:** `pnpm nx run api:build` ✅ clean. `pnpm nx run admin:lint` ✅ 0 errors (same 62 pre-existing warnings elsewhere). `pnpm nx run admin:build` — `/products` and all other routes compiled cleanly; same known Windows-only post-build symlink failure at the very end (unrelated, seen on the dashboard pass too). **Not visually verified in a live browser** — needs the user's own eyes for: dropdown open/close animation, modal transitions, and actually exercising the new bulk tag/title edit end-to-end against real data.

---

---

## Phase 1 — orders (DONE)

**Gap-audit (row 33 vs. `apps/admin/src/app/(admin)/orders/page.tsx`):**
- `[thiếu hẳn]` "Are your processing times accurate?" tip card (thumbs up/down + "Review processing times" CTA) — entirely missing.
- `[lệch]` "Clear all" → real Etsy says "Reset filters".
- `[lệch]` Destination filter was a free-text country-code input; real Etsy shows radio options (All/Vietnam/United States/Everywhere else).
- **Deliberately NOT changed** (considered, not a gap): the bulk toolbar ("Update progress" 10-status dropdown) and the 7-tab status bar (All/New/In Production/Shipped/Delivered/Completed/Cancelled) vs. real Etsy's simple "Complete order"/"More actions" + 2-tab (New/Completed) pattern. This reflects a genuinely richer order-lifecycle model already built into this app's backend (`PENDING_PAYMENT` → ... → `DISPUTED`), not a UI mismatch — relabeling the copy to match Etsy's simpler 2-state model would misrepresent real functionality, so left as-is.

**Implemented:**
- `apps/admin/src/app/(admin)/orders/page.tsx` — added the processing-times tip card (links to `/settings/delivery`, non-functional thumbs-up/down since there's no feedback-persistence endpoint — honest decorative UI, matches how little the static screenshot itself proves about their behaviour); "Clear all" → "Reset filters"; Destination free-text input → 3-option radio group (All/Vietnam/United States) reusing the existing `country` query param — **"Everywhere else" intentionally omitted**, since it needs a NOT-IN filter the orders API doesn't support (only equality on one country).

**Left as gaps (need backend, not built):** dispatch-status radios (Overdue/Today/Tomorrow/Within a week/No estimate) — the current "dispatch by" date is a frontend-only `createdAt + 3 days` guess, not a real per-order field the API can filter on; "Personalised"/"Upgrade requested" order-attribute checkboxes — no such fields exist on the order model; "20 orders per page" size selector — page size is hardcoded, low priority.

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors (same 62 pre-existing warnings).

---

## Phase 1 — remaining modules

Continuing straight through per user instruction ("tiếp tục đến hết") — logging each module here as completed, applying the same standard: pure-UI fixes done directly, small additive backend done when clearly safe, larger backend/business-logic gaps documented rather than built or faked.

## Phase 1 — finances (DONE)

**Gap-audit (rows 13-23 vs. `apps/admin/src/app/(admin)/finances/**`):** this module was already close to Etsy-faithful going in (Payment account balance cards, Payment settings' 4 sub-tabs, Legal/tax info form all already matched the screenshots structurally). Two real gaps found:
- `[lệch]` Payment account's "Recent activities" mini-table only rendered Type/Date/Net — `FinancesLedgerEntryDto` already carries `description` and `balance` too (used by the Monthly Statements page's fuller table), just not read here.
- `[lệch]` Legal-and-tax-info summary view omitted "Date of birth" even though `taxInfo.dateOfBirth` exists (real Etsy's readonly summary shows it, current form only used it inside the edit form).
- `[đúng]` Payment settings (Methods/Currency/Billing/Address tabs) and Monthly Statements page were already high-fidelity — no changes needed there.

**Implemented:**
- `apps/admin/src/app/(admin)/finances/page.tsx` — Recent-activities table gained Description and Balance columns (data already fetched, zero new API calls) + a "View all monthly statements" button below it, matching row 17's footer link.
- `apps/admin/src/app/(admin)/finances/tax-information/page.tsx` — summary (non-editing) view now also shows Date of birth when set.

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors.

## Phase 1 — stats (DONE, light touch — module was already high-fidelity)

**Gap-audit (rows 35-37 vs. `apps/admin/src/app/(admin)/stats/page.tsx`):** this page was already unusually close to the reference — 4-stat row (Visits/Orders/Conversion/Revenue) with delta%, trend chart, and a **Shopper Stats grid that already matches all 6 real Etsy cards exactly** (Item favourites/Shop follows/Reviews/Repeat buyers/Cities reached/Abandoned baskets, including the "Is this helpful?" feedback row). Real differences found:
- `[lệch]` Page header said "Shop Traffic"; real Etsy's page title is literally "Stats" (fixed).
- `[thiếu hẳn]` "Marketplace insights" (row 37) has **no corresponding page at all** — `stats/listings/page.tsx` is a different feature (per-listing view-count drill-down). Real Etsy's Marketplace Insights is a shop-owner-facing search-term explorer (search box, saved searches, category-tabbed trending terms). Notably, this app already has a "Top searches" section powered by `STATS_SEARCH_TERMS` — but it's gated `enabled: isPlatformContext`, i.e. only SUPER_ADMIN ever sees it today. Building a real Marketplace Insights page would mean deciding whether to expose that platform-wide search data to individual shop owners too, which is a product/data-access decision, not a pure styling fix — flagged rather than built this pass.

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors (header-only change).

## Phase 1 — Customer service stats, Etsy search visibility, messages, policy vaiolations (DONE, light touch)

All four of these pages turned out to already be close, deliberate re-implementations of their Etsy references (built earlier this session per project memory, not left over from a generic scaffold) — most of the Phase-0 "NOT YET IMPLEMENTED" notes from before this session's route audit were wrong; corrected now.

- **search-visibility** (row 2): `[đúng]` — risk-factor cards, "right on track" section, bonus-tips 3-card row all already match structurally and copy-wise. No changes.
- **policy-violations** (row 34): `[đúng]` — empty-state copy/icon and the 3-card "Get to know our policies" row already match. No changes.
- **customer-service-stats** (row 1): `[đúng]` on the 4 score cards, badge banner, tools/tips row, Help Centre CTA. `[thiếu hẳn]` (flagged, not built — moderate scope): the "Welcome future Star Seller" progress-icon banner at the top, and the FAQ accordion with left-nav at the bottom, from the full screenshot — a real gap but a multi-hour addition, not a quick copy/layout fix; logged for a future pass rather than rushed.
- **messages** (row 32): `[lệch]` empty-state copy "No conversations found" → real Etsy "No conversations to see here!" (fixed). `[thiếu hẳn]` (flagged, not built — large scope): the folder sidebar (Starred/From potential buyers/From Etsy/Sent/All/Unread/Spam/Recycling bin) and bulk toolbar (Mark Unread/Read/Report/Archive/Label ▾) shown in the reference don't exist — the current inbox is a simpler unified list. Building the folder/label/spam/recycling-bin model would need new backend concepts (a label system, soft-delete/trash, spam classification) well beyond a UI pass; flagged, not attempted.

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors.

## Phase 1 — delivery settings (DONE for the parts that were pure UI; larger items flagged)

**Gap-audit (rows 5-12, 38-39, from Phase 0's own already-detailed findings):**
- `[lệch]` `DeliveryProfileModal.tsx` rendered as a `Drawer` (side slide-over); real Etsy uses a centered `Modal`.
- `[lệch]` Delivery-time fields were number `<input>`s; real Etsy uses two `Select` dropdowns.
- `[lệch]` Tab labeled "Delivery guarantee"; real Etsy says "US free delivery guarantee" (confirmed twice in Phase 0, rows 21/39).
- `[thiếu hẳn]` (flagged, not built): an entire "Delivery upgrades (Optional)" section inside the create/edit profile modal — needs a per-profile upgrade-tier data model (name/extra price) that doesn't exist yet; a real backend/data-model addition, not a styling fix.
- `[thiếu hẳn]` (flagged, not built): `ProcessingProfileModal.tsx` should be a dedicated full page with a `← Back to Delivery profiles & processing` breadcrumb, not a modal — this is a routing/page-structure change (new route, moving all form state, wiring the breadcrumb) with real product-decision weight, not attempted this pass.
- `[thiếu hẳn]` (flagged, not built): "Edit origin post code" should be a small anchored `Popover`, a component that doesn't exist yet anywhere in `libs/ui` — building a whole new positioned-popover primitive is bigger than this one usage justifies without a wider decision on where else it'd be used.
- `[đúng]` (re-confirmed, not a gap): the Delivery profiles table row already correctly omits a "duplicate" action — no backend duplicate endpoint exists; left as a documented, intentional gap.

**Implemented:**
- `apps/admin/src/components/shipping/delivery/DeliveryProfileModal.tsx` — `Drawer`→`Modal` (`size="lg"`), delivery-time min/max fields → `Select` dropdowns (0-30 day presets) instead of number inputs. Shared with the product editor's Pricing & Shipping tab (`PricingShippingTab.tsx`) — verified both call sites only pass data props, no Drawer-specific assumptions, so the swap is safe everywhere it's used.
- `apps/admin/src/app/(admin)/settings/delivery/page.tsx` — tab label and section heading "Delivery guarantee" → "US free delivery guarantee".

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors.

---

## Phase 1 — marketing (DONE for what was pure/small-additive UI; structural redesigns flagged)

**Correction to Phase 0:** rows 42-47, 54-63 assumed 4 dialogs "have no confirmed corresponding component." That was wrong — checking `apps/admin/src/components/marketing/` directly found **all of them already exist**: `SetUpSaleModal.tsx` (Run a sale), `TargetedOffersModal.tsx` (Set up targeted offers), `BuyerOffersPanel.tsx` (Accept offers from buyers), plus `PromotionModal.tsx` (Promo code, in `components/promotions/`) — and the `marketing/sales/page.tsx` hub already reproduces the real Etsy 5+2+2-card layout ("Send offers to interested buyers" / "Drive traffic and move inventory" / "Up your average order value") near-exactly, including "Your key sales and discounts" and the empty "Join our next sales events" section.

**`SetUpSaleModal.tsx` (Run a sale, rows 54-63):** `[đúng]` — already an accurate 3-step wizard (Customise → Which listings → Review), same field labels/hints/step indicator/button copy as the reference. One real gap found and fixed: `[thiếu hẳn]` "Free standard delivery" as a discount-type option (row 55) — only percentage was supported. **Implemented:** added a discount-type `<select>` (Percentage off / Free standard delivery) reusing the promotions system's existing `FREE_SHIPPING` type (already handled at checkout server-side, so this is pure UI + trivial payload wiring, not new business logic) — `SetUpSaleModal.tsx`, `marketing/sales/page.tsx`'s `handleSaveSale`.

**`TargetedOffersModal.tsx` (rows 44-47):** `[lệch]` — structurally different interaction model. Real Etsy: pick ONE trigger type via checkbox inside a single "Create 1 offer" flow, with a "Set an order minimum (optional)" expandable link and per-type "Include ... from the last N days" checkbox copy. Current: all 4 trigger types are independent, always-on-able campaigns (Toggle per row) each with their own Save button, Percentage/Fixed-amount as buttons instead of Etsy's simpler always-percentage-with-promo-code framing, no promo-code field, no order-minimum option, and "lookback window" exposed as a raw number input instead of the friendly checkbox copy. This is a genuinely different, arguably more flexible design (independent always-on campaigns vs. one-at-a-time offer creation) — flagged as a real UI/interaction-model gap worth a dedicated redesign pass, not attempted here given the scope (it's a different component architecture, not a copy/style fix).

**`PromotionModal.tsx` (Promo code, row 42):** `[đúng]` on substance — every real Etsy field has a working equivalent (Discount Type incl. bonus Free Shipping option Etsy doesn't even offer here / Min Order Amount / Max Total Uses & Max Uses Per Customer ≈ Etsy's Redemption limit / start+expiry dates with a "never expires" checkbox ≈ Etsy's "No end date" / code field with a bonus Generate button). Labels are more admin-dashboard-toned ("Min Order Amount") than Etsy's buyer-friendly copy ("Order minimum") — a copy-polish opportunity, not a functional gap; not changed this pass.

**`BuyerOffersPanel.tsx` (Accept offers from buyers, row 43):** `[đúng]` on substance — `offersScope: 'ALL_LISTINGS' | 'SPECIFIC_LISTINGS'` and `offersMaxDiscountPercent` map directly to the reference's "Which listings can buyers make offers on?" and "maximum discount" controls.

**`BuyTogetherModal.tsx` (rows 48-51):** already rebuilt earlier this session; re-confirmed against the fuller Phase 0 findings — split-panel intro, listing-picker grid, live original/new-total price preview, and success screen all match. `[thiếu hẳn]` (flagged, not built): the yellow "Looks like you're running a sale on one or more of these listings…" conflict-warning banner (row 49) — this was already a documented, deliberate simplification in the code's own comments (no easy cross-reference to active sales exists at the picker layer); left as-is rather than rushed.

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors, `pnpm nx run api:build` ✅ clean.

## Phase 1 — edit_store_page (NOT STARTED — flagging, not attempting)

**Gap-audit (row 28):** searched the entire admin app for any storefront/"Shop Home" editor matching the reference (colour theme picker, hero banner with edit overlay, featured-items grid with custom sort, Announcement, About section with video/photos/headline/story/links, Shop members, Shop policies CTA, FAQ, Seller details/EU status) — **no such page exists anywhere in the repo.** The closest things found were `stores/settings/page.tsx` (platform-wide fee/payout settings, unrelated) and the `settings/page.tsx` "General" tab (a simple Logo + Banner image upload, nowhere near the scope of the reference). This is a genuine full-page, from-scratch build — new route, new data fields (announcement text, About video/photos, FAQ entries, "Featured area" custom sort likely need new `Store` schema columns), well beyond a UI-layer pass. **Not attempted** — flagged for a dedicated future task with its own scoping conversation, same as the earlier-flagged backend-needing items but larger in scope than any of those.

## Phase 1 — listing_detail_page (admin product editor) — DONE

**Scope confirmed with user:** this is the SELLER-facing admin Listing Editor (`apps/admin/.../products/[id]/edit`), matching the actual content of `listing_detail_page.png` — not a buyer-facing Product Detail Page (no PDP screenshot exists in `etsy-assets/`).

**Resolution caveat:** the reference is a single flattened composite, 1920×9955px. At that aspect ratio, exact pixel spacing and hex colors are not reliably legible — this pass audited at the structural/copy/field level (section presence, order, labels, microcopy), which IS legible, and explicitly flags anything needing pixel-level verification as unconfirmed rather than inventing false precision.

**Verification table (per the mandated a→d loop, one row per checked item):**

| Item checked | Result | Note |
|---|---|---|
| Photo & Video — header copy "Photo and video" + subtitle | PASS | exact match |
| Photo & Video — 5-col grid, Featured badge on slot 0, fixed Video slot, drag-reorder | PASS | matches |
| Photo & Video — "Add up to 20 photos and 2 videos" instruction row | PASS | matches |
| Photo & Video — "Adjust thumbnails" + 3-size preview (Square/Portrait/Wide) | PASS | matches |
| Item details — header + "Selected category" / Title / Description structure | PASS | matches |
| Item details — AI title-suggestion banner buttons "Apply suggestion" / "Discard" | **FAIL → FIXED** | code said "Dismiss", real Etsy says "Discard" |
| Item details — Title tips bullet copy (3rd bullet exact wording) | **NOT VERIFIABLE** | text too small to transcribe reliably at this resolution — not fixed, not guessed |
| Item options — top-level "Item options / Let buyers know what choices are available for this item" header | **FAIL → FIXED** | was entirely missing; tab jumped straight to "Variations" with no page-level intro |
| Item options — Variations → Custom options → Attributes section order | PASS | matches |
| Item options — "Materials" / "Primary color" / "Secondary color" labels | **FAIL → FIXED** | American spelling; real Etsy (and this app's own convention elsewhere — "Customise", "personalise") uses "colour" |
| Item options — "Show more attributes" expand button | **FAIL → FIXED** | real Etsy says "Show all attributes" |
| Price and inventory — section header + Price/Quantity/Add SKU presence | PASS | matches; individual field spacing not pixel-verified |
| Delivery, processing, and returns — header + Processing profile / Delivery option / Returns cards | PASS | matches |
| GPSR manufacturer/safety info + Customs information (HS Code) — tab placement | **FAIL → FIXED** | fully-built, already-working fields (`gpsrInfo`, `hsCode`) were rendering under "How It's Made" tab; real Etsy places them under "Pricing & Delivery" right after Returns. Moved `HsCodeSection` + GPSR block + `GPSRModal` render from `HowItsMadeTab.tsx` to `PricingShippingTab.tsx` (same form context, same field names — no data/logic change) |
| How it's made — Who made it / What is it / tools-used / Production partners | PASS | matches |
| Settings — Shop section / Feature this listing / Renewal options | PASS | matches |
| Settings footer — clean-state message | **FAIL → FIXED** | code said "All changes saved.", real Etsy says "You have no unsaved changes." |
| Card footer "N sold" vs. Etsy's per-listing renewal-date concept | tracked separately | see `listing` module findings above (`ProductCard.tsx`) — not part of this editor page |

**Implemented (files changed this pass):**
- `apps/admin/src/components/products/edit/tabs/ItemDetailsTab.tsx` — "Dismiss" → "Discard"
- `apps/admin/src/components/products/edit/tabs/ItemOptionsTab.tsx` — added page-level "Item options" header; "Primary color"/"Secondary color" → "Primary colour"/"Secondary colour"
- `apps/admin/src/components/products/edit/ShowMoreAttributes.tsx` — default collapsed label "Show more attributes" → "Show all attributes"
- `apps/admin/src/components/products/edit/tabs/PricingShippingTab.tsx` — gained the `HsCodeSection` component, GPSR block, `GPSRModal` import/render, and the `hsCode`/`gpsrInfo`/`showGpsrModal`/`hasGpsr` state — all moved in from `HowItsMadeTab.tsx`
- `apps/admin/src/components/products/edit/tabs/HowItsMadeTab.tsx` — the above removed; `productId` prop dropped (no longer used by this tab)
- `apps/admin/src/components/products/edit/ProductEditShell.tsx` — updated the `<HowItsMadeTab />` call site (prop removed); clean-state footer message copy fix

**Verify:** `pnpm nx run admin:lint` ✅ 0 errors (same 62 pre-existing warnings). `pnpm nx run admin:build` — `/products/[id]/edit` compiled cleanly (webpack/tsc passed before the known unrelated Windows symlink failure at the very end of the run).

**Checklist status: every row above has a result — PASS, FAIL→FIXED, or explicitly NOT VERIFIABLE (never left blank/pending).** One item (title-tips 3rd bullet exact copy) could not be verified at this image resolution and was left as-is rather than guessed, per the "ảnh mơ hồ → hỏi, không tự quyết" rule — flagging it here instead of silently skipping it.

---

## Phase 1 — SESSION SUMMARY

All 13 planned modules were reached. Breakdown:

| Module | Status |
|---|---|
| dashboard | Rebuilt Home/Recent-activity tabs, risk banner, Top tasks, Stats row, Shop advisor; honest empty-states where no backend data exists |
| listing | Copy/bulk-bar fixes + 2 new bulk actions (edit-tags/edit-title, small additive backend) |
| orders | Tip card, copy fixes, Destination radio filter |
| finances | Recent-activities table columns, DOB display fix — module was already high-fidelity |
| stats | Header fix; Marketplace Insights page gap flagged (needs product decision) |
| Customer service stats / search-visibility / policy-violations | Already high-fidelity, no/minimal changes |
| messages | Copy fix; folder/label system flagged as large gap |
| delivery settings | Drawer→Modal, day-Select fields, tab rename; upgrades section / processing-profile-as-page / Popover flagged |
| marketing | FREE_SHIPPING sale option added; TargetedOffersModal interaction-model gap flagged; rest already high-fidelity |
| edit_store_page | **Built (Option C, full)** — new schema (additive), new self-service page `settings/shop-home`, reused far more existing infra than expected — see dedicated section below |
| listing_detail_page | Exists, large, not deep-audited this pass |

**Files changed this Phase 1 pass** (in addition to `docs/etsy-ui-audit.md`):
- Backend: `apps/api/src/modules/admin/dto/dashboard.dto.ts`, `apps/api/src/modules/admin/admin.service.ts`, `apps/api/src/modules/products/admin-products.controller.ts`, `apps/api/src/modules/products/products.service.ts`
- Frontend: `apps/admin/src/components/dashboard/ShopOwnerHome.tsx` (new), `apps/admin/src/app/(admin)/dashboard/page.tsx`, `apps/admin/src/app/(admin)/products/page.tsx`, `apps/admin/src/app/(admin)/orders/page.tsx`, `apps/admin/src/app/(admin)/finances/page.tsx`, `apps/admin/src/app/(admin)/finances/tax-information/page.tsx`, `apps/admin/src/app/(admin)/stats/page.tsx`, `apps/admin/src/app/(admin)/messages/page.tsx`, `apps/admin/src/app/(admin)/settings/delivery/page.tsx`, `apps/admin/src/components/shipping/delivery/DeliveryProfileModal.tsx`, `apps/admin/src/components/marketing/SetUpSaleModal.tsx`, `apps/admin/src/app/(admin)/marketing/sales/page.tsx`

**Verification performed every step:** `pnpm nx run admin:lint` (0 errors throughout) and `pnpm nx run api:build` (clean throughout); `pnpm nx run admin:build` compiled every route including all touched ones, with a known unrelated Windows-only symlink-permission failure at the very end of the build (`os error 1314`) present both before and after this pass's changes.

**Not verified — needs the user's own eyes:** every visual/interaction detail a static screenshot and a passing build can't confirm — modal open/close and tab-switch transitions, hover states, focus rings, the new dashboard "Not now" dismiss animation, the new delivery-time `Select` dropdowns' actual rendered alignment, and exercising the new bulk product tag/title edit and FREE_SHIPPING sale end-to-end against real data. No browser-automation tool is available in this environment and local NextAuth isn't configured for a logged-in manual check (both limitations noted earlier this session).

**Places with zero screenshot coverage where a decision had to be made independently:** the dashboard's Stats-row day range label ("This month" instead of Etsy's "Today" toggle, since only monthly KPI data exists); the orders Destination radio set (3 options instead of Etsy's 4, since "Everywhere else" needs NOT-IN filtering the API doesn't support); which of the marketing dropdown's items to keep vs. hide (kept only the 2 backed by a real bulk API).

---

## Phase 1 — edit_store_page (DONE — Option C, full build)

**User approved Option C** (full Etsy-parity build, including new schema) after reviewing 3 scoped options presented earlier. Built directly, additive migration, matching this session's established pattern.

**Schema reuse audit before adding anything new** — checked what already existed on `Store`/related models before writing new columns:
- `Store.description` already backs "About > your story" (same column the dashboard "Share your story" checklist reads) — reused, not duplicated.
- `Store.followers: StoreFollow[]` already exists — backs the "Admirers" count directly (`_count.followers`).
- `ShopSection` model (name/sortOrder/products) already exists — backs the item-grid section filter tabs.
- `StoreTaxInfo.sellerType` (INDIVIDUAL/BUSINESS, already fully built for the Finances tax-info page) — reused directly for "Seller details > Your seller status in the EU", no new field.
- `Store.totalOrders` / `Store.createdAt` — reused for "Sales" and "On Etsy since {year}".
- `POST /admin/stores/:id/banner` and `/logo` already existed and were **already reachable by ADMIN (own store)**, not SUPER_ADMIN-only as first assumed — reused directly, no new upload endpoints needed for banner/logo.
- `ASSETS_PRESIGN` (existing presign-upload flow, already used by the product photo/video editor) reused for About-section photos/video — **caught and fixed my own draft bug**: an early version misused the banner-upload endpoint (which sets `Store.bannerUrl` as a side effect) to upload About photos, which would have silently overwritten the shop banner every time someone added an About photo. Fixed before shipping.

**Genuinely new (additive-only) schema** — migration `prisma/migrations/20260818120000_shop_home_editor/`:
- `Store`: `tagline`, `location`, `colorTheme`, `announcement` + `announcementUpdatedAt`, `aboutHeadline`, `aboutVideoUrl`, `aboutPhotoUrls` (String[], max 5), `ownerBio`, `featuredProductIds` (String[], max 4) — all nullable or empty-array-default, no existing data touched.
- New model `StoreFaq` (id/storeId/question/answer/sortOrder), cascade-deletes with Store.
- **Not verified against a live database** — this environment has no configured `DATABASE_URL`, so `prisma migrate dev` could not run; the migration SQL was hand-written following this repo's existing migration format and `prisma generate`/`prisma validate` both passed (schema-only checks, no DB needed). **Needs a real `pnpm db:migrate` run against a dev database before this ships**, to confirm the hand-written SQL applies cleanly.

**Backend (all additive, reusing the existing StoreContextService/`assertOwnership` self-service pattern already used by finances/products/etc.):**
- `apps/api/src/modules/stores/admin-stores.controller.ts` — `AdminUpdateStoreDto` extended with the 9 new fields; `PATCH /admin/stores/:id` now accepts them (same endpoint, same ownership check, no new route). Added 4 new FAQ endpoints (`POST/PATCH/DELETE .../faqs`, `PATCH .../faqs-reorder`), same ownership pattern.
- `apps/api/src/modules/stores/stores.service.ts` — `adminUpdateStore` extended; `adminGetStore` now also includes `faqs` and `_count.followers` (→ `followerCount`); 4 new FAQ service methods.
- `libs/shared/constants/src/lib/routes.ts` — `STORE_FAQS`, `STORE_FAQ`, `STORE_FAQS_REORDER` added.

**Frontend (new page):** `apps/admin/src/app/(admin)/settings/shop-home/page.tsx` — Colour theme picker, banner/logo upload (click-to-upload with hover overlay, reusing existing endpoints), editable tagline/location (inline edit), Items grid with All/On-sale filter + "Featured area" picker (reuses the existing `ListingPicker` component from marketing, capped at 4), Announcement textarea with "Last updated on" timestamp, About section (video + up to 5 photos via presign-upload, headline, story — reusing `description`), Shop members (owner avatar + editable bio), Shop policies CTA card, FAQ list with add/reorder/delete, Seller details (reads `StoreTaxInfo.sellerType`, links to the existing tax-information page to edit). Nav entry added to `AdminSidebar.tsx` under Store Settings → "Shop Home".

**Deliberately simplified / not built (disclosed, not silently dropped):**
- FAQ reorder uses simple up/down arrow buttons, not drag-and-drop (real Etsy likely drag-reorders; this is a lower-risk, equally-functional substitute).
- No rich-text editor for the About story — reuses the existing plain-text `description` field/editor already wired into the dashboard checklist; building a separate rich-text field would duplicate that concept.
- Shop policies CTA links to `/products` as a placeholder "Try it now" target — no dedicated shop-policies-template page exists in this codebase yet; a real destination needs a product decision, not a UI guess.

**Side finding (unrelated bug, noticed while wiring the sidebar):** `AdminSidebar.tsx`'s "Marketplace Insights" nav item points to `/stats/listings` — but per the `stats` module findings above, that route is a per-listing view-count drill-down, not the search-term-explorer "Marketplace Insights" feature the label promises. This is a real, pre-existing mislabel, not something this pass introduced — flagged here since it was noticed in the same file, not fixed (out of this task's scope).

**Verify:** `npx prisma validate` ✅, `npx prisma generate` ✅ (schema-only, no DB). `pnpm nx run api:build` ✅ clean. `pnpm nx run admin:lint` ✅ 0 errors. `pnpm nx run admin:build` — `/settings/shop-home` route compiled successfully; the build run then hit a **disk-full environment failure** (C: drive reached 100% used, 0 bytes free, mid-session) unrelated to code — see below.

**Environment incident (disclosed, not a code defect):** during this task the dev machine's C: drive filled to 100% (0 bytes free), which failed one `Edit` tool call outright (`ENOSPC`) and interrupted the final `admin:build` run. Freed ~4.4GB (pnpm store prune + Chrome cache across all profiles, both user-approved) before continuing — drive is now at ~4GB free / 97% used, enough to build but still tight. **A full `admin:build` end-to-end pass has not been re-confirmed since the cleanup** — recommend re-running it, and freeing more space (an unrelated 11.7GB `Silver14Nail` folder on the Desktop was identified but left untouched, plus Docker/WSL cache were not present on this machine so weren't a factor) before trusting a production build.

**Not verified — needs the user's own eyes:** the hand-written migration against a real database; actual upload flows (banner/logo/photo/video) end-to-end with real files; hover/click affordances on the banner/logo edit overlays; whether the reused `ListingPicker` component's "max 4" cap renders sensibly inside the featured-picker modal's fixed width.

## Backlog

Deferred items with a concrete "next time" plan, not just "not built."

### Banner "Change layout" / drag-reposition / delete (from `edit_store_page` screenshots)

**What the screenshot shows, not built this pass:** while editing the banner, real Etsy shows a "Change layout" pill, a 4-arrow drag handle to reposition the image within the crop, and a trash icon to remove the banner — on top of the plain select-file-and-save flow this app now has.

**Why deferred:** none of the three has any backing data in `Store` today — `bannerUrl` is just a single image URL, with no layout variant, no crop/position offset, and no "clear banner" endpoint (only upload exists).

**Minimum data model to build it for real:**

| Feature | Field | Type | Migration |
|---|---|---|---|
| Change layout | `Store.bannerLayout` | `String?` (enum-like: `'standard' \| 'focused'`, mirrors the ~2 layout variants real Etsy offers) | additive column, default `null` → `'standard'` |
| Drag-reposition | `Store.bannerFocusX`, `Store.bannerFocusY` | `Decimal?` (0.00–1.00, CSS `object-position` fraction) | 2 additive columns |
| Delete banner | *(no new field)* | — | new `DELETE /admin/stores/:id/banner` endpoint (service: set `bannerUrl: null`, delete the S3 object via existing `StorageService.deleteFile`) |

**Effort estimate** (based on comparable work already done this session — the FAQ CRUD slice took ~1 migration + 4 endpoints + frontend wiring):

- Backend: 1 migration (3 columns) + `PATCH .../banner-layout` endpoint (reuses `assertOwnership` pattern) + `DELETE .../banner` endpoint — **~1–1.5 hrs**.
- Frontend: drag-to-reposition needs real pointer-event math against the banner's `aspect-[4/1]` box (down/move/up handlers, clamp 0–1, live CSS `object-position` preview) — the most novel part, nothing to reuse in this codebase yet. Layout-variant rendering (2 CSS arrangements) + delete-confirm button — **~2–3 hrs**.
- Total: **~half a day**, dominated by the drag-reposition interaction, not the schema.

Not started — flagging for a future pass rather than building against an unapproved data model.

### "Mixed grid" Shop Home layout (Ezihubb Plus scope B — locked, not yet built)

**What real Etsy shows, not built this pass:** an alternate Featured-area layout — one large "hero" listing tile plus several smaller tiles in a mixed-size grid — as an alternative to the current uniform grid. Locked into **Ezihubb Plus scope B** (colour theme + Mixed grid layout + Marketplace Insights extended quota) in the Phase 1 policy decision; **only the gate exists so far** (`PlusFeature` has no dedicated enum member for this yet — Phase 1 code gates just `SHOP_COLOR_THEME` and `MARKETPLACE_INSIGHTS_EXTENDED_QUOTA`, per the explicit scope lock in this session).

**Why deferred:** `Store` has no field for a layout variant at all today (`featuredProductIds` only stores which listings are pinned, not how they're arranged), and the public storefront doesn't render a Featured section from real data yet — building the grid CSS ahead of the data model would be building against an unapproved shape.

**Minimum data model to build it for real:**

| Piece | Field / change | Type | Migration |
|---|---|---|---|
| Layout choice | `Store.featuredLayout` | `String?` (enum-like: `'grid' \| 'mixed'`, default `'grid'`) | 1 additive column |
| Gate | `PlusFeature.SHOP_FEATURED_MIXED_GRID` | new enum member in `libs/shared/constants/src/lib/plus-features.ts` | none (code-only) |
| Enforcement | `adminUpdateStore` — same pattern as the existing `colorTheme` check: reject `featuredLayout: 'mixed'` with `ERR_PLUS_REQUIRED` when `!entitlements.canUseFeature(storeId, SHOP_FEATURED_MIXED_GRID)` | — | none (code-only) |
| Public render | `getStoreBySlug` — return `featuredLayout: hasPlus ? store.featuredLayout : 'grid'` (force free stores to the plain grid even if a stale `'mixed'` value is on the row, mirroring the `colorTheme` gate) | — | none (code-only) |

**Effort estimate** (based on the `colorTheme` gate + storefront-render slice already built this session):

- Backend: 1 migration (1 column) + reuse of the existing entitlement-check pattern in `adminUpdateStore`/`getStoreBySlug` — **~30–45 min**, since the gate plumbing (service injection, `EntitlementsService`, error shape) already exists and this is mostly copy-the-pattern.
- Frontend (admin): layout picker control on the Shop Home settings page, disabled/upsell state when not entitled — **~1 hr**.
- Frontend (public storefront): the actual mixed-size CSS grid (1 hero tile + N small tiles, responsive breakpoints) — the only genuinely new work, nothing to reuse yet since the storefront currently has zero Featured-section rendering — **~2 hrs**.
- Total: **~3.5–4 hrs**, dominated by the public-storefront grid CSS, not the gate.

Not started — flagging for a future pass (Phase 3 UI or later) rather than building against a layout shape nobody has approved yet.

### `PlatformSettings.platformName` not editable in admin (same silent-swallow class as the Plus-price bug, deferred)

**What's missing:** `UpdatePlatformSettingsDto` (`apps/api/src/modules/stores/dto/admin-stores.dto.ts`) still doesn't declare `platformName`, so a `PATCH` with that field is silently stripped by the global `ValidationPipe({ whitelist: true })` — same mechanism as the `plusMonthlyPrice`/`plusAnnualPrice`/`offsiteAdsFeeRate` gaps that were fixed this session (see the Ezihubb Plus backend work above).

**Why deferred:** purely a display string (`PlatformSettings.platformName`, `@default("EziHubb")`) — no financial or entitlement logic reads it the way `offsiteAdsFeeRate` feeds order fee math. Explicitly deprioritized by the user relative to the fee-rate gap.

**Fix, when picked up:** add `@IsString() @IsOptional() @MaxLength(100) platformName?: string;` to `UpdatePlatformSettingsDto`, following the exact pattern of the other `@IsString()` field already in that DTO (`payoutSchedule`). Trivial, ~5 min, no schema change needed (column already exists).

### `admin-products.controller.ts` variation/variant endpoints — type-checked but unbounded (correction to an earlier mischaracterization)

**Correction first:** an earlier report this session said these routes have "no decorator at all / not validated." That was wrong — re-checked directly against `admin-products.controller.ts` and they DO use real `class-validator`-decorated DTO classes (declared inline in the controller file, not in a separate `dto/`, which is why a prior grep of the *service* method signatures missed them). The actual gap is narrower and different in kind: **type is enforced, domain bounds are not** — and one route has no structural validation at all. Listed precisely below so this doesn't get backlogged on a wrong premise.

| Route | DTO | What's missing | Concrete risk |
|---|---|---|---|
| `PATCH :id/variations/:groupId/options/:optionId` | `VariationOptionPatchDto` | No `@MaxLength` on `name`/`value`/`colorHex` (the sibling `VariationOptionCreateDto` used by the CREATE route has `@MaxLength(100)`/`@MaxLength(20)` — PATCH is looser than CREATE for the same fields). No `@Min`/`@Max` on `priceDelta` anywhere. | Unbounded `priceDelta` (e.g. `-999999` or `999999`) silently changes the computed variant price (base price + delta) with no floor/ceiling — a negative final price is possible with no guard. Unbounded string length is a data-quality/storage-bloat risk, not a DB failure (columns are unbounded `String`). |
| `PATCH :id/variations/variants/:variantId` | `VariantPatchDto` | `price`/`quantity` are `@IsNumber()` only, no `@Min(0)`. | A negative `price` or `quantity` can be written directly to `ProductVariant`. Negative price would flow into storefront price/cart-total math as a negative line item. Negative `quantity` breaks the `available = quantity − reserved` assumption used for stock checks — not verified how each downstream call site handles a negative value, which is itself part of the risk (undefined behavior, not a defined one). |
| `POST :id/variations/apply` → `variantEdits[]` | `VariantEditDto` (nested in `ApplyVariationsDto`) | Same missing `@Min(0)` on `price`/`quantity` as above — same underlying `ProductVariant` fields, reached via a second route. | Same as above. |
| `PATCH :id/variation-settings` | `VariationSettingsDto` | `skuPrefix` has no `@MaxLength`. `variesBy` is `@IsString({ each: true })` with no `@IsIn()` restricting values to real dimension names. | An arbitrary `variesBy` entry that doesn't match any real `VariationGroup.name` would silently desync from whatever matches on that string downstream (`syncVariantsFromGroups`) — not traced further, flagged as unverified risk. |
| `POST :id/variations/groups/bulk` | `BulkSaveVariationsDto { groups: object[] }` | **No structural validation at all** — `object[]` has no `@ValidateNested`/`@Type`, unlike the sibling `ApplyVariationsDto` which properly validates `groups: ApplyVariationGroupDto[]`. Whatever is inside `groups` is passed to the service via a raw type-cast (`dto.groups as Parameters<...>[1]`), not a runtime check. | Widest gap of the five — malformed/missing nested fields become `undefined` deep inside `bulkSaveVariations` with no validation error at the boundary; how the service handles that wasn't traced (out of scope for this pass). |

Not fixed this pass — user explicitly deferred (`KHÔNG sửa lượt này`). Whoever picks this up next: add `@Min(0)` to the 3 price/quantity fields first (cheapest, highest concrete-risk fix), then decide whether `bulkSaveVariations` should be given the same `@ValidateNested`/`@Type` treatment as `applyVariations` or deprecated in its favor (the comment at `admin-products.controller.ts:706-709` suggests `applyVariations` may already be the intended single-commit successor).

### DTOs not yet column-diffed against their Prisma model (pattern-matched only)

While auditing the `UpdatePlatformSettingsDto` whitelist-swallow bug, grepped for the same *mechanism* (whole DTO spread wholesale into a Prisma `update`/`upsert` call — `data: dto` / `update: dto` / `...dto`) across `apps/api/src/**/*.service.ts`. Only `PlatformSettings`, `ProcessingProfile`, and the products-module inline-type methods used that exact mechanism (see the "Rà lỗ hổng cùng loại" audit — `ProcessingProfile` came back clean).

The following hand-written `Update*Dto` classes do **not** appear in that grep — meaning their services likely map fields one-by-one rather than spreading the whole DTO into Prisma (a structurally lower-risk pattern for this specific bug, since a missing field there is a visible gap in the service code itself, not a silent whitelist-strip). That inference was **not verified column-by-column against their target Prisma model** — flagging the list so it doesn't get mistaken for a completed audit:

- `UpdateCampaignDto`, `UpdateAffiliateDto`, `UpdateAffiliateSettingsDto` (`campaigns`/`affiliates` modules)
- `UpdateStoreDto`, `UpdateStoreOrderDto` (`stores` module)
- `UpdateOrderStatusDto` (`orders` module)
- `UpdateBundleOfferDto`, `UpdateOffersSettingsDto` (`promotions`/`marketing` modules)
- `UpdateBankAccountDto`, `UpdateCurrencyDto`, `UpdateAutoBillingDto`, `UpdateTaxInfoDto` (`finances` module)
- `UpdateProductDto` (`products` module)
- `UpdateWishlistShareDto`, `UpdateProfileDto`, `UpdatePushPreferencesDto` (`users` module)
- `UpdateCartItemDto` (`cart` module)
- `UpdateConversationStatusDto` (`messages` module)

Not started — needs a real column-by-column diff per DTO against its Prisma model before any of these can be called "clean," the same way `ProcessingProfile` was confirmed clean this session.

### Admin controllers missing `@Roles` — platform-wide data reachable by plain `ADMIN` (confirmed, not fixed)

Found while answering a direct question about the `AdminPlatformSettingsController` fix (was it the only one?) — grepped every `@AdminController(...)` usage, then read each candidate's actual Prisma queries (not just the route name) to confirm whether `StoreContextService` scopes it safely despite the missing `@Roles` override. Most do (`AdminFinanceController`, `AdminSellerPayoutsController`, orders/products/shipping/messages/reviews/finances/fulfillment/partner-api all verified safe via `store-context.service.ts:39-54` — a plain `ADMIN` can never get `isPlatformContext: true`). **These 5 do not use `StoreContextService` and their Prisma queries have no store filter at all — a plain `ADMIN` reaches platform-wide data/actions today:**

| Controller | Route | Risk |
|---|---|---|
| `AdminEmailTemplatesController` | `GET/PATCH /admin/email-templates/:slug` | **Highest** — any shop owner can rewrite the body of a platform-wide transactional email template (password reset, order confirmation, etc.), sent to every user. Content-injection risk, not just a data leak. |
| `AdminCatalogController` | categories/collections, `/admin/catalog/sync-mega-menu` | Platform-wide taxonomy — a seller could delete a category used by hundreds of other stores' products. |
| `AdminTagsController` | `/admin/tags` | Platform-wide tags, no store filter. |
| `AdminAttributesController` | `/admin/attributes/:type` | Platform-wide filter attribute values (color/material/...), no store filter. |
| `AdminProductionPartnersController` | `/admin/production-partners` | Platform-wide list, no store filter. |

One more, lower-confidence (different failure mode, not verified): `AdminTranslationsController` (`/admin/translations/:entityType/:entityId`) takes an arbitrary `entityId` with no visible ownership check in the controller — possible IDOR if `translation.service.ts` doesn't check ownership either (not read).

### `@Roles` decorator-order bug — silently overwritten guards on 3 controllers (fixed)

**What happened:** `@Roles(Role.SUPER_ADMIN)` written *after* `@AdminController(...)` in source had no effect. Decorators stacked on one declaration apply bottom-to-top — the one closer to the class runs **last** and wins when both touch the same metadata key. `@AdminController(...)` internally calls `Roles(Role.ADMIN, Role.SUPER_ADMIN)` itself (see `apps/api/src/common/decorators/admin-controller.decorator.ts`). With `@AdminController` on top and `@Roles(SUPER_ADMIN)` below it (the pattern first used for `AdminSubscriptionsController` and copied from there to two more controllers), `@AdminController`'s internal call ran *after* and silently reset the roles list back to `['ADMIN', 'SUPER_ADMIN']`. The override was never in effect — this is invisible from reading the source; the code looks correct.

**How it was actually caught:** not by reading code, by running `Reflect.getMetadata('roles', ControllerClass)` against the real, compiled class and comparing it to what the source claimed. This is the only reliable check — see the full audit table below.

**Affected — all now fixed by reordering (`@Roles` moved above `@AdminController`):**

| Controller | File | Real metadata before fix | Real metadata after fix |
|---|---|---|---|
| `AdminSubscriptionsController` | `apps/api/src/modules/subscriptions/admin-subscriptions.controller.ts` | `['ADMIN','SUPER_ADMIN']` | `['SUPER_ADMIN']` |
| `AdminPlatformSettingsController` | `apps/api/src/modules/stores/admin-stores.controller.ts` | `['ADMIN','SUPER_ADMIN']` | `['SUPER_ADMIN']` |
| `AdminEmailTemplatesController` | `apps/api/src/modules/admin/admin-email-templates.controller.ts` | `['ADMIN','SUPER_ADMIN']` | `['SUPER_ADMIN']` |

**Real-world impact while broken:** any authenticated `ADMIN` (shop owner) could grant themselves Ezihubb Plus for free, extend it arbitrarily, or revoke another store's subscription (`AdminSubscriptionsController`); could `PATCH` platform-wide fee rates, payout thresholds, and the Ezihubb Plus list price (`AdminPlatformSettingsController`); could read/rewrite platform-wide transactional email template bodies — a content-injection vector into every automated email sent to every user (`AdminEmailTemplatesController`, additionally reachable via a live UI page, `/settings`, which had no page-level role guard either — also fixed, see below).

**Full real-metadata audit — every `@AdminController`/`@Roles` class in the codebase (25 + 14 = 39 classes), declared vs actual, via `Reflect.getMetadata` (not code reading):**

All 39 now match their intended design. Besides the 3 above, everything else was already correct:
- 11 classes are class-level `['SUPER_ADMIN']` only, correctly enforced (`AdminUsersController`, `AdminAuditLogController`, `AdminExportController`, `AdminTeamController`, `AdminAffiliatesController`, `CampaignsController`, `ModerationController`, `AdminCustomersController`, plus the 3 fixed above) — none of these use `@AdminController` at all, they build `@Controller` + `@UseGuards` + `@Roles` explicitly, which never had this collision risk.
- 1 class (`AdminSettingsController`) has the `['ADMIN','SUPER_ADMIN']` class default, but **every one of its 11 methods** carries its own correctly-enforced `@Roles(['SUPER_ADMIN'])` — confirmed real, not just declared.
- `AdminStoresController`: class default `['ADMIN','SUPER_ADMIN']`, with `approveStore`/`rejectStore`/`suspendStore` correctly narrowed to `['SUPER_ADMIN']` at method level; `updateStore`/`uploadBanner`/`uploadLogo`/FAQ routes/`getStoreProducts`/`getStoreOrders` correctly rely on `StoreContextService.assertOwnership()` instead (see below — verified by reading every line, not just checking metadata).
- `StoreViolationsController`/`PaymentsController`: fully method-level design, every method's real metadata matches its intended role list.
- The remaining classes (`AdminAttributesController`, `AdminCatalogController`, `AdminProductionPartnersController`, `AdminTagsController`, `AdminTranslationsController`, `AdminCacheController`, `AssetsController`, and the `StoreContextService`-scoped ones) have no `@Roles` at all — matches the earlier finding above; their exposure comes from missing scoping, not from a decorator bug.

**Method-level `@Roles` vs class-level default — verified with real metadata, not NestJS docs:** method-level always wins, no exception found across every example in the codebase (`AdminSettingsController`'s 11 methods, `AdminStoresController`'s 3 method overrides, `StoreViolationsController`, `PaymentsController`). This makes sense structurally, not just empirically: `@AdminController`'s internal `Roles(...)` call is a **class** decorator — it can never attach metadata to an individual method function, so there is no possible collision at the method level the way there is at the class level. The bug above is specific to two class-level decorators competing for the same target; method-level `@Roles` was never at risk.

### `StoreContextService`/ownership-guard coverage — verified route-by-route (not pattern-matched)

Previously flagged as "verified by grepping for a `StoreContextService` reference in the file" — weaker evidence than reading every route. Read every route in `AdminStoresController` + the 9 controllers previously only pattern-matched. Result: **all clean except one.**

- **`AdminStoresController`** — every store-scoped route (`updateStore`, `uploadBanner`, `uploadLogo`, `createFaq`/`updateFaq`/`deleteFaq`/`reorderFaqs`, `getStoreProducts`, `getStoreOrders`) calls `storeContext.resolve()` then `assertOwnership()` before touching data. `listStores`/`getStore` scope via an explicit `isShopOwner` check. Fully clean.
- **`AdminProductsController`** (937 lines, ~45 routes) — every `:id`-scoped route is protected by a class-wide `@UseGuards(ProductOwnershipGuard)` (read `product-ownership.guard.ts` directly: resolves store context, no-ops for platform-context SUPER_ADMIN, otherwise loads the product and 403s on a store mismatch — correctly designed). Every non-`:id` route (`stats`, list, `draft`, create, `bulk`, `export`) separately calls `storeContext.resolve()`. **One gap found:** `GET /admin/products/seo-stats` (`getSeoStats()`) has no `:id` param (guard no-ops) and no `storeContext` call of its own — its 4 `prisma.product.count()` queries have zero store filter, returning **platform-wide** SEO stats to any `ADMIN`. Moderate severity: aggregate counts only, no per-record data or PII, but not what the seller-facing SEO stats page is supposed to show. **Not fixed — listed only, per instruction.**
- **`AdminOrdersController`** (206 lines) — class-wide `@UseGuards(OrderOwnershipGuard)`; read `order-ownership.guard.ts` directly: correctly checks a `StoreOrder` row exists for (orderId, callerStoreId) — an `Order` can span multiple vendor stores, and this is the right join to check. No-ops for platform-context SUPER_ADMIN. All `:id` routes covered; the few non-`:id` routes (list, `bulk-packing-slips`, `export`) separately call `storeContext.resolve()`. Fully clean.
- **`AdminFulfillmentController`**, **`AdminShippingController`**, **`AdminFinancesController`**, **`AdminApiKeysController`**, **`AdminShopSectionsController`**, **`AdminMessagesController`** — read in full, every single route calls `storeContext.resolve()` + `requireStoreId()`/`resolveTargetStoreId()`/`assertOwnership()` before touching data, including cross-checking child-row ownership before mutating (e.g. `admin-fulfillment.controller.ts`'s `saveMapping` verifies both the connection and the product belong to the resolved store before creating a mapping). Fully clean.
- **`AdminReviewsController`** — every route resolves `context.storeId` and passes it into the service call (e.g. `reviewsService.adminDeleteReview(reviewId, context.storeId ?? undefined)`). **Caveat:** confirmed the controller correctly *passes* the scoping value; did not re-verify inside `reviews.service.ts` that the service actually filters/rejects on a storeId mismatch rather than just accepting it as an optional hint. Not re-read this pass — flagged so this isn't mistaken for full-depth verification.

### Prevention — proposals, not implemented

The decorator-order bug will recur the next time someone writes a new `@AdminController(...)`-based controller intended as SUPER_ADMIN-only, because nothing catches the wrong order except manually running `Reflect.getMetadata`. Three options, not mutually exclusive:

1. **A real automated test that walks every controller and asserts declared vs. actual metadata.** Cost: one new spec file, cheap to write (the audit script written for this session's investigation is most of it), runs in the existing Jest suite, catches this exact bug and any future recurrence automatically, zero false positives since it reads real `Reflect` state. Downside: only catches it for controllers the test enumerates — a brand new controller file needs to be added to the test's list manually (unless the test itself globs the filesystem for every `*.controller.ts` and imports each, which is more robust but couples the test to the module-loading behavior of every controller, including any with import-time side effects — this session's audit script hit exactly one such case, `AdminOrdersController` failing to import standalone due to an unrelated relative-path issue in `pdf.service.ts`, requiring a workaround).
2. **`@AdminController(path, roles?)` takes an explicit roles override as a parameter instead of a separate stacked `@Roles(...)` decorator.** Cost: touches the decorator's own definition (1 file) plus every call site that currently stacks `@Roles` after it (3, now fixed) — but removes the footgun structurally: there's no second decorator to mis-order, so the class of bug becomes impossible rather than merely tested-for. Slightly changes the call convention (`@AdminController('email-templates', [Role.SUPER_ADMIN])` instead of two decorators) — a small, one-time migration for the 3 existing sites, no ongoing cost after.
3. **Lint rule or code-review convention enforcing decorator order.** Cost: cheapest to write (a custom ESLint rule, or just a documented convention + PR-review checklist item), but weakest — a lint rule needs someone to actually write and wire up an AST check for "no `@Roles` below `@AdminController` on the same class," and a convention alone is exactly the kind of thing that failed silently here already (the wrong order was copied between 3 files without anyone noticing).

Not implemented — awaiting a decision on which 1-2 to build.

### Colour theme: why there is no white/black-text-by-luminance mechanism

The Follow button and the tab-nav active state use `textSafeHex` as the **text/underline/border colour on a 10%-alpha tint of that same colour** — they never paint text on a solid fill of the theme colour. Because the background is ~90% white in every case, contrast is governed entirely by `textSafeHex` vs. white (all 12 verified ≥ 4.5:1), so choosing white-or-black text by background luminance would have nothing to apply to.

An earlier draft carried a `textOn: 'light' | 'dark'` field plus `SHOP_COLOR_THEME_TEXT_LIGHT`/`_DARK` constants for exactly that solid-fill case. Nothing ever consumed them — **deleted** from `libs/shared/constants/src/lib/shop-color-themes.ts` so nobody later assumes the mechanism exists and builds on it. If a genuine solid-fill-with-text surface is ever added, that luminance choice has to be re-derived then; do not resurrect the old field on the assumption it was already correct for the new surface.

### SUPER_ADMIN has TWO states — do not collapse them (sidebar "Store Settings")

A recurring source of confusion, resolved deliberately. `SUPER_ADMIN` is not one audience:

| State | `isPlatformContext` | Nav rendered | Sees "Store Settings"? |
|---|---|---|---|
| SUPER_ADMIN, platform context (administering the marketplace) | `true` | `NAV_SECTIONS` | **No** — correct, this is the requirement |
| SUPER_ADMIN, "My Store" mode (acting as owner of the store they personally own) | `false` | `getShopNavSections()` | **Yes** — correct, they ARE the shop owner here |
| ADMIN (shop owner) | `false` | `getShopNavSections()` | **Yes** |
| Session still loading (`role === ''`) | `false` | *(none)* | n/a — see below |

An earlier version gated the section on `role === 'ADMIN'` *inside* `getShopNavSections`, which looked right but was wrong: that function is only ever consumed in the `!isPlatformContext` branch, i.e. by whoever is already acting as a shop owner. Filtering by role again inside it contradicted the definition of My Store mode, and left a SUPER_ADMIN who owns a store with **no route at all** to edit their own Shop Home — `/stores/[id]` only edits name/description plus approve/reject/suspend; it has no Shop Home editor. The platform-context requirement is enforced by the `isPlatformContext` branch itself, not by a second filter inside the shop nav. **Do not re-add that filter.**

Related fix in the same pass: `useNavData` now waits on `isReady`. While the session loads, `role` is `''`, which is neither `SUPER_ADMIN` nor `ADMIN` — so `isPlatformContext` computed `false` and a SUPER_ADMIN briefly rendered the *shop-owner* nav. The role-dependent item list is now empty until the role is actually known (the sidebar shell, logo and user block still render).

Also renamed: the `/settings` page's first tab is labelled **"Platform"**, not "Store". It edits platform identity (site name, favicon, contact email, company address, currency) via `/admin/settings/store` and is SUPER_ADMIN-only — it is *not* a seller's shop, and was being mistaken for one. Behaviour unchanged, label only. **Do not delete this tab**: it is the only UI for those platform fields, and a report of "SUPER_ADMIN still sees a Store tab" was this name collision, not a leftover.

### `isReady` audit — which role-dependent UI actually needed gating

Full grep scope, so this isn't re-litigated from a partial list: (1) every `useAdminMode()` consumer in `apps/admin/src` — 12 real call sites; (2) every direct `session.user.role` read used for UI branching — 7 more.

The key detail: while the session loads, `role` is `''`, so `isPlatformContext` computes **`false` — the shop-owner value**. Adding `isReady &&` to a boolean that is already `false` changes nothing. Gating only helps where `false` renders *shop-owner content to a SUPER_ADMIN*:

| Site | Verdict |
|---|---|
| `AdminSidebar.tsx` navSections | **Fixed** — `false` rendered the whole shop-owner nav to a SUPER_ADMIN |
| `GetHelpButton.tsx` | **Fixed** — `false` offered clickable shop-owner help links to a SUPER_ADMIN |
| `payouts/page.tsx` | **Already handled** — has its own `sessionReady = role !== ''` gating both redirect and render. Equivalent to `isReady`; converting it would be pure refactor |
| `reviews` (`showStore`), `settings/api-keys` + `settings/fulfillment` (`showOverview`), `stats` (platform-only sections) | **Flash is in the safe direction** — `false` *hides* platform-only chrome, it does not expose shop-owner content. Cosmetic only; queries key off `explicitStoreId`, which is `undefined` during load either way, so no wrongly-scoped request is issued. Eliminating the flash entirely needs an early-return spinner — a UX tradeoff, deliberately not decided unilaterally |
| `dashboard/page.tsx`, `(admin)/layout.tsx` | **N/A** — Server Components (`getServerSession`, `await cookies()`); the session is already resolved, there is no loading state |
| `stores/[id]/permissions`, `stores/[id]/subscription`, `settings/page.tsx` | **Already safe** — all use `if (role && role !== 'SUPER_ADMIN')`, which no-ops on `undefined` |
| `stores/[id]/page.tsx:599` | **Open** — `{role !== 'ADMIN' && ...}` is `true` while `role` is `undefined`, so a shop owner briefly sees the Approve/Reject/Suspend/Permissions panel. Buttons are server-blocked, so it is visual only. Not fixed — outside the scope of that pass |

## Ezihubb Plus Phase 3 — post-deploy verification checklist

None of these have been confirmed with a real click in a real browser against a real database — no dev DB has existed in this environment for the whole Plus build (sandbox has no local Postgres/Docker, only production RDS via SSH). Automated checks (real `pnpm nx run api:test`, real `lint`/`build` across `api`/`admin`/`client`, and — for the storefront colour theme specifically — a real running `client` dev server hit with `curl` against **mocked** `getStoreBySlug` data, see the "Storefront colour theme" section above for what that did and didn't prove) are the ceiling reachable without one. Run every item below for real after the next deploy, in order, before calling Ezihubb Plus done.

**Split into two groups.** As of this session, group B (missing code) is empty — the storefront colour-theme render gap (originally case #13) was closed this session, not deferred. Anything that lands back in group B later is a regression, not an open item.

### A — blocked only by environment (DB + real login), code exists and is either unit-tested or dev-server-verified with mocked data

Seller (ADMIN), no Plus:
1. `/settings/plus` shows `NONE` state, correct copy
2. Shop Home: colour theme section shows the locked/upsell state
3. Attempting to change colour theme surfaces the `ERR_PLUS_REQUIRED`-specific message (`api-client.ts`'s `ApiError.code` branch in `shop-home/page.tsx`), not the generic error alert
4. Every OTHER Shop Home field (tagline, announcement, social links, featured products) still saves normally — confirmed by reading the JSX (the lock only wraps the colour-theme block), not yet by clicking

SUPER_ADMIN, `/stores/:id/subscription`:
5. Grant MONTHLY → UI updates, badge shows `ACTIVE`
6. Grant a 2nd time → 409 renders as the inline `actionError` box, not a blank/broken screen (backend 409 itself is real-tested in `subscriptions.service.spec.ts`)
7. Extend → period end advances correctly (the date math itself — including the Jan-31/leap-year edge cases — is real-tested in `subscriptions.service.spec.ts`; only the UI round-trip is unverified)
8. Sidebar: SUPER_ADMIN doesn't see "Ezihubb Plus" (seller nav item); shop-owner ADMIN doesn't see "Stores"/"Platform Settings"/the subscription tab — confirmed by reading `AdminSidebar.tsx`'s two separate nav trees, not yet by looking at two real logged-in sessions side by side
9. Revoke → badge becomes `REVOKED`

After grant (seller):
10. `/settings/plus` shows `ACTIVE` with the correct period-end date
11. Shop Home colour theme unlocks, a swatch pick saves successfully
12. Storefront shows the picked colour — code now exists and was dev-server-verified with mocked `colorTheme` values (see above); this item is specifically about the real end-to-end path: real `getStoreBySlug` response → real page → real render

After revoke:
13. Storefront colour reverts to default; `featuredProductIds` unaffected (the API-layer behavior for this is real-tested in `stores.service.spec.ts`; only the storefront's own render of it, once real gated data flows through, is unverified)
14. Admin editor (`adminGetStore`) still shows the old saved colour — per locked decision (b)-A (colour data is kept forever, never deleted)
15. Granting again brings the old colour back immediately (proves the retained-forever behavior, not just documented intent)

Data leakage:
16. Real `GET /seller/subscription` JSON — confirm no `grantedByUserId`/`paymentProvider`/`externalSubscriptionId` (`priceAtPurchase` is correctly present by design — it's the seller's own price, not internal data). Unit-tested already (`toSellerView` spec) with a mocked subscription object; this item is about seeing the real HTTP response body.
17. A seller's JWT called directly against `GET /admin/stores/:id/subscription` (SUPER_ADMIN-only route) → real `403`, not just the `@Roles(Role.SUPER_ADMIN)` decorator being present in source.

### A2 — sidebar role states (added after the v0.2.0 "Store Settings" report)

Could not be verified locally at all: the admin app authenticates via NextAuth → API → Postgres, and this environment has no `.env` (no `NEXTAUTH_SECRET`/`DATABASE_URL`) and no Postgres on 5432, so no role can be logged in as. Running the dev server only reaches the login page, which proves nothing about the sidebar. Verify all four by eye after deploy:

18. SUPER_ADMIN, platform context → sidebar shows the platform nav; **no** "Store Settings" section
19. SUPER_ADMIN, "My Store" enabled → sidebar shows the shop nav **including** "Store Settings" → `/settings/shop-home` (this is the v0.2.0 bug being fixed)
20. ADMIN (real shop owner) → sidebar shows the shop nav including exactly one "Store Settings" → `/settings/shop-home`
21. On a hard refresh of any of the above, no flash of the *other* role's nav while the session loads (the `isReady` guard) — watch the first paint specifically
22. `/settings` first tab reads **"Platform"**, not "Store", and still saves site name/favicon/contact/address/currency correctly

### B — blocked by missing code

*(empty as of this session)*

### How to run this checklist for real

Needs, at minimum: a real Postgres reachable from wherever `apps/api` runs, the `20260818140000_ezihubb_plus` migration actually applied (still pending — see the Ezihubb Plus backend report earlier in this doc for the SQL and the rollback story), 1 SUPER_ADMIN account, and 1 ADMIN account owning 1 store. From there: items 1–4 and 10–15 are `curl`/browser checks against a logged-in seller session; 5–9 and 17 against a logged-in SUPER_ADMIN session; 16 is a single authenticated `GET`.

Not fixed — user explicitly kept this as "liệt kê, tôi quyết từng cái" (list only, decide individually), same discipline as the `UpdatePlatformSettingsDto` gaps above. `AdminCacheController` (`POST /admin/cache/flush`, platform-wide Redis flush) also lacks `@Roles`, but flagged separately as lower severity — availability nuisance, not a data leak.
