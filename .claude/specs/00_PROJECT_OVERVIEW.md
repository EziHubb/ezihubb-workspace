# MapleLoomHandmade Clone — Project Overview Spec

**Stack:** Next.js 14 (App Router) · NestJS · PostgreSQL · Prisma ORM · Redis · S3-compatible Storage  
**Scope:** Full clone — Storefront + Admin Dashboard + Order Management + Personalization Engine  
**Version:** 1.0.0  
**Last updated:** 2025

---

## 1. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                     Nx Workspace (pnpm)                          │
│                                                                   │
│  apps/client (Next.js 14)    apps/admin (Next.js 14)            │
│  port 3000                   port 3001                           │
│  — Storefront                — Admin Dashboard                   │
│  — Auth pages                — Orders / Products / Customers     │
│  — Account pages             — Promotions / Reviews / Shipping   │
│  — Customizer UI             — Analytics / Settings              │
│         │                           │                            │
│         └──────────┬────────────────┘                           │
│                    │ REST API (HTTP)                              │
│  apps/api (NestJS) │ port 3002                                   │
│  ─────────────────────────────────                               │
│  Auth · Users · Products · Catalog                               │
│  Customization · Cart · Orders · Payments                        │
│  Shipping · Reviews · Promotions · Search                        │
│         │                    │                                   │
│  libs/shared/types           libs/ui                             │
│  libs/shared/constants       (shared React components)           │
│  libs/shared/api-client                                          │
└──────────┬──────────────────────────────────────────────────────┘
           │
    ┌──────┴────────┬────────────────┐
    ▼               ▼                ▼
PostgreSQL 15    Redis 7         Cloudflare R2
(Prisma ORM)   (Cache +         (Images,
                BullMQ)          Previews,
                                 Assets)
```

---

## 2. Danh sách modules

| # | Module | Mô tả | Spec file |
|---|--------|--------|-----------|
| 01 | **Auth** | Đăng ký, đăng nhập, OAuth, JWT | `01_auth.spec.md` |
| 02 | **User** | Hồ sơ, địa chỉ, wishlist | `02_user.spec.md` |
| 03 | **Catalog** | Danh mục, collection, tag | `03_catalog.spec.md` |
| 04 | **Product** | Sản phẩm, variants, template | `04_product.spec.md` |
| 05 | **Personalization** | Customizer, AI preview, upload ảnh | `05_personalization.spec.md` |
| 06 | **Cart** | Giỏ hàng, session cart | `06_cart.spec.md` |
| 07 | **Order** | Đặt hàng, trạng thái, lịch sử | `07_order.spec.md` |
| 08 | **Payment** | Stripe, PayPal, Gift Card | `08_payment.spec.md` |
| 09 | **Shipping** | Tính phí vận chuyển, tracking | `09_shipping.spec.md` |
| 10 | **Review** | Đánh giá sản phẩm | `10_review.spec.md` |
| 11 | **Promotion** | Coupon, discount, sale | `11_promotion.spec.md` |
| 12 | **Notification** | Email, push, in-app | `12_notification.spec.md` |
| 13 | **Admin** | Quản trị toàn hệ thống | `13_admin.spec.md` |
| 14 | **Search** | Tìm kiếm, filter, sort | `14_search.spec.md` |

---

## 3. Roles & Permissions

| Role | Quyền |
|------|-------|
| `guest` | Browse, xem sản phẩm, thêm giỏ hàng (session) |
| `customer` | Tất cả quyền guest + đặt hàng, xem lịch sử, đánh giá |
| `admin` | Quản lý sản phẩm, đơn hàng, users, promotions |
| `super_admin` | Toàn quyền hệ thống |

---

## 4. Môi trường

| Env | Mô tả |
|-----|-------|
| `development` | Local dev |
| `staging` | Test trước khi release |
| `production` | Live |
