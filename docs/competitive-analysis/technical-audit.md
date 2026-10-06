# 01 — EziHubb: Technical audit

> Cập nhật 02/10/2026: nội dung bên dưới giữ làm baseline audit 01/10, không phải trạng thái code mới nhất. Đã có các bản sửa local về identity, draft/review access, webhook, provider failure, affiliate concurrency, search và số lượng trong revenue. Xem [re-audit từng finding](../production-hardening/final-re-audit.md), [kết quả kiểm thử](../production-hardening/progress.md) và [pilot readiness](../production-hardening/pilot-readiness.md). Chưa deploy/chạy giao dịch thật; không nâng claim cạnh tranh, traction hoặc doanh thu. Các vấn đề tiền, Google MFA và guest messaging còn chặn paid pilot.

Ngày chốt: **01/10/2026**. Phạm vi: repository tại commit `57d8628768374c6be577a30e884bcd1a134cf833` **cộng các thay đổi chưa commit đang có trong working tree**. Không đọc secrets, truy cập database/SSH production, gọi thử thanh toán, chạy migration hoặc sửa ứng dụng. Các thay đổi phân quyền sản phẩm chưa commit được đánh giá như code cục bộ, không phải tính năng đã deploy.

## Kết luận điều hành

EziHubb có nền tảng marketplace đáng kể: storefront, giao diện seller/platform admin, danh mục và biến thể, giỏ hàng, order/store-order, messaging, promotions, ledger và các adapter dịch vụ ngoài. Đây không chỉ là bộ màn hình mock. Tuy nhiên, **chưa đủ bằng chứng để gọi toàn bộ hệ thống là marketplace giao dịch production-ready**. Các điểm chặn đáng chú ý là phân biệt token MFA/access, nhận quyền sở hữu dữ liệu guest, tính nhất quán payment–ledger–payout, tồn kho và độ tin cậy analytics. Bằng chứng và điều kiện ảnh hưởng nằm dưới đây; mức ưu tiên trong [gaps-and-risks](gaps-and-risks.md).

Không có số liệu traffic, doanh thu đối soát, seller độc lập hoạt động, SLA hoặc retention được cung cấp/xác minh trong đợt này. Không dùng số lượng bảng, module hoặc screenshot làm bằng chứng traction.

## 1. Phương pháp và giới hạn

| Nhãn | Ý nghĩa trong bộ báo cáo |
|---|---|
| Verified | Code cộng kiểm thử/chạy thành công; luôn ghi rõ phạm vi cục bộ, mock hay tích hợp |
| Implemented | Đã lần theo đường xử lý liên quan trong code; chưa chứng minh hoạt động thực tế đầu-cuối |
| Partial | Có triển khai nhưng thiếu đường xử lý hoặc có lỗi quan trọng |
| UI Only / Mock | Giao diện, cấu hình lưu được hoặc số liệu giả; chưa có năng lực ngoài hệ thống được quảng bá |
| Missing | Không tìm thấy triển khai trong phạm vi source đã tìm; không khẳng định hoạt động thủ công bên ngoài không tồn tại |
| Unknown | Thiếu quyền, cấu hình runtime, dữ liệu hoặc bằng chứng để kết luận |

Đã lập inventory toàn workspace và rà soát các miền nghiệp vụ trong brief; deep trace chọn các đường có rủi ro thương mại cao. Đây **không phải** chứng nhận bảo mật, penetration test, kiểm toán kế toán hay chứng minh đúng mọi nhánh của mọi endpoint. Phát hiện từ phân tích tĩnh được ghi riêng với kết quả test.

## 2. Bản đồ kiến trúc

`pnpm nx show projects --json` trả về 8 project: `client`, `admin`, `api`, `shared-api-client`, `shared-constants`, `shared-types`, `shared-utils`, `ui`. `nx show project … --json` xác nhận các target typecheck/build/lint và client Playwright. Stack được khai báo trong [package.json](../../package.json): Next/React, NestJS, Prisma/PostgreSQL, Mongoose/MongoDB, Redis/BullMQ, TanStack Query; version khai báo không đồng nghĩa version production.

```text
Buyer storefront / Seller & Platform admin
                  │ shared API client + HTTP / realtime
                  ▼
       NestJS modular API + authorization
          ├── PostgreSQL: commerce, identity, ledger, messages
          ├── MongoDB: rich product details / customization / menu
          ├── Redis: cache, counters, sessions of jobs
          └── BullMQ: domain events → workers → external services
                                      ├── payment providers
                                      ├── storage, email, push
                                      └── fulfillment, moderation, AI
```

Đây là modular monolith với job processors, **không phải bằng chứng microservices độc lập**: feature modules cùng được lắp vào [AppModule](../../apps/api/src/app/app.module.ts#L137). Compose chạy API, client, admin, Redis và Mongo trên cùng deployment definition; PostgreSQL được truy cập qua connection string. Không xác minh nhà cung cấp, topology thực tế hay tính sẵn sàng cao của database. [Compose](../../docker-compose.yml#L34), [PrismaService](../../apps/api/src/prisma/prisma.service.ts#L20).

### Inventory và mức độ rà soát

Có 36 thư mục module API. Các nhóm dưới đây phủ inventory, nhưng mức độ hoàn thiện được đánh giá bằng luồng, không bằng tên module.

| Nhóm | Module/phần liên quan | Đánh giá |
|---|---|---|
| Identity/admin | auth, users, admin-users, admin | Session/RBAC có thực; MFA và guest ownership có lỗi đáng kể |
| Catalog/seller | products, catalog, stores, database | CRUD, variants, shop customization có logic DB; đồng bộ hai DB và inventory cần tăng bảo đảm |
| Conversion | search, cart, customization, promotions, campaigns | Có luồng thực; filter parity và general customizer chưa hoàn chỉnh |
| Transactions | orders, payments, finances, shipping, fulfillment, order-tracking, pdf | Adapter thật, nhưng chưa phải chuỗi tài chính khép kín |
| Engagement | messages, notifications, realtime, unsubscribe | Feed/chat/email/push có triển khai; guest-access và subscriber persistence còn hạn chế |
| Growth | marketing, affiliates, analytics, shop-stats, marketplace-insights | Có dữ liệu thật xen lẫn mock/ước lượng và phép tính sai |
| Platform | subscriptions, moderation, reviews, partner-api, translations, currency, assets | Có implementation; nhiều năng lực phụ thuộc cấu hình/provider hoặc chưa được kiểm chứng |

### Database và tính nhất quán

Inventory đếm được **95 Prisma models, 48 enums, 18 thư mục migration**. Đây là độ rộng schema, không phải 95 tính năng hoàn chỉnh. [Schema](../../prisma/schema.prisma).

- `StoreOrder` tách một order theo shop; unique `(orderId, storeId)` và index theo store/status hỗ trợ multi-store. Các khoản tiền dùng Decimal. Ledger có unique `reversalOfId` giúp tránh hoàn bút toán lặp. [StoreOrder](../../prisma/schema.prisma#L687), [ledger](../../prisma/schema.prisma#L812), [migration retention](../../prisma/migrations/20260908120000_order_financial_retention/migration.sql#L1).
- Mongo lưu `product_details` có `productId` unique, nhưng liên kết này không phải foreign key xuyên hai database. Product read kết hợp Prisma và Mongo; cần kiểm thử cập nhật một bên thất bại, orphan và recovery. [Mongo schema](../../apps/api/src/modules/catalog/schemas/product-detail.schema.ts#L79), [product read](../../apps/api/src/modules/products/products.service.ts#L376).
- Migration có SQL ngoài Prisma: sequence mã order, partial/expression indexes conversation, function `nanoid`. Không thể tái tạo đầy đủ chỉ bằng schema diff. Hàm DB `nanoid(12)` dùng SQL `random()`, khác generator JS `customAlphabet`; ID không nên là bằng chứng quyền truy cập hay security token. [Sequence](../../prisma/migrations/20260824100000_order_number_sequence/migration.sql#L17), [NanoID migration](../../prisma/migrations/20260901090000_nanoid_primary_keys/migration.sql#L4), [JS generator](../../apps/api/src/common/utils/product-id.ts#L1).
- Index có tồn tại, nhưng chưa chạy EXPLAIN, load test, migration replay trên database sạch hoặc kiểm tra schema drift production. Không có cơ sở định lượng sức chịu tải.

## 3. Trace các luồng quan trọng

### T1 — Authentication, session, MFA: Partial

API login → password/Google identity → JWT/session → JWT/role/permission guards → user/session trong PostgreSQL. Có refresh credential, logout-all, session revocation; các unit test session đã chạy thành công trong đợt này.

Nhưng password đúng có thể nhận token `totp-pending`, ký cùng access secret, có role và không có `sid`. JWT strategy không kiểm tra `purpose`; nhánh legacy cho phép token không `sid`. Đây là chuỗi chấp nhận sai loại token theo phân tích tĩnh. Token có hạn 5 phút và vẫn chịu expiry/deleted-user/global-revocation, nhưng các điều kiện đó không thay thế MFA. [signPartialToken](../../apps/api/src/modules/auth/auth.service.ts#L713), [JwtStrategy](../../apps/api/src/modules/auth/strategies/jwt.strategy.ts#L36), [validateSession](../../apps/api/src/modules/auth/validate-session.ts#L23).

Ngoài ra registration nối guest orders/conversations theo email **trước khi xác minh mailbox**, rồi cấp session; Google login không đi qua cùng gate TOTP. Xem điều kiện và đề xuất kiểm thử âm tính trong R01–R03 của [risk register](gaps-and-risks.md). Test session hiện có không chứng minh MFA an toàn.

### T2 — Product → variant → custom options → cart: Implemented, inventory Partial

Seller `ManageVariationsModal` tải groups/settings/variants → API apply → product/store ownership guards → transaction đồng bộ combinations → ProductVariant/PostgreSQL; rich custom options nằm ở Mongo. Các variant ID hiện hữu được giữ lại và combinations lỗi thời được retire để không phá liên kết order/cart. [UI](../../apps/admin/src/components/products/edit/ManageVariationsModal.tsx#L1076), [transaction](../../apps/api/src/modules/products/products.service.ts#L1764).

Buyer `ProductPurchasePanel` kiểm tra options bắt buộc rồi gửi variant/quantity/custom values → cart service kiểm tra variant thuộc product và còn available. [Purchase panel](../../apps/client/src/components/product/ProductPurchasePanel.tsx#L1039), [cart validation](../../apps/api/src/modules/cart/cart.service.ts#L120). Pricing server có active dates/scope, fixed/percentage sale và lựa chọn giá tốt nhất; **Verified cục bộ** cho các ca unit test giá thấp nhất của variant, không phải mọi tổ hợp coupon/quốc gia. [Pricing](../../apps/api/src/modules/products/pricing.util.ts#L25), [tests](../../apps/api/src/modules/products/pricing.util.spec.ts#L20).

Không có reservation/stock-floor ở đường checkout được trace. Sau thanh toán, worker decrement product quantity; nhiều dòng cùng product bị skip sau dòng đầu, không có persistent consumption marker, không decrement variant stock. Đây là lý do inventory mang nhãn Partial. [Checkout validation](../../apps/api/src/modules/orders/orders.service.ts#L253), [low-stock service](../../apps/api/src/modules/products/low-stock.service.ts#L57).

Platform read-only product guard được kiểm thử cục bộ, nhưng là **working-tree chưa commit**. Không dùng nó để tuyên bố production đã đóng mọi đường ghi sản phẩm. [Guard](../../apps/api/src/modules/products/guards/product-store-write.guard.ts#L25).

### T3 — Graphical personalization/AI: Partial

Customizer state → upload/background removal/art style/preview API → Sharp/storage và BullMQ → Replicate hoặc image service → polling → cart. Upload và art-style có provider call thực. [Client state](../../apps/client/src/lib/store/customizer.store.ts#L241), [upload](../../apps/api/src/modules/customization/customization.service.ts#L54), [image worker](../../apps/api/src/queue/image.processor.ts#L120).

Giới hạn: `generateFieldsPreview` chỉ render `DEMO_TEMPLATE`, không phải template seller tùy ý; background removal có thể trả nguyên ảnh dưới trạng thái thành công; draft-by-ID thiếu ownership/expiry check. [Preview](../../apps/api/src/modules/customization/customization.service.ts#L178), [fallback](../../apps/api/src/queue/image.processor.ts#L65), [draft lookup](../../apps/api/src/modules/customization/customization.service.ts#L293). Chưa chạy provider thật hoặc test output print-ready. **Không gọi đây là nền tảng thiết kế sản xuất tự động đã hoàn chỉnh.**

### T4 — Checkout → payment → order events: Partial

Checkout UI → order API/ownership → server pricing và shipping → transaction Order/StoreOrder/OrderItem → nhánh manual hoặc provider → webhook → domain events → seller confirmation/commission/stock/email/fulfillment.

Mặc định code chỉ bật online payments khi `ONLINE_PAYMENTS_ENABLED==='true'`. Manual mode tạo request CONFIRMED, không Payment, không ledger doanh thu, trả `paymentRequired:false`; client đi tới success `mode=request`. [Service gate](../../apps/api/src/modules/orders/orders.service.ts#L116), [response](../../apps/api/src/modules/orders/orders.service.ts#L920), [checkout UI](<../../apps/client/src/app/[locale]/(storefront)/checkout/page.tsx#L404>). Đây là order request, **không phải paid GMV**. Giá trị env production Unknown.

Stripe/PayPal có code gọi provider, kiểm tra payer và webhook; không được suy từ đó rằng live onboarding/settlement đã thành công. Đường Stripe commit PAID rồi publish BullMQ có khe hở: publish lỗi, webhook retry thấy PAID và return. Không tìm thấy transactional outbox/reconciliation cho khe hở này trong API đã rà soát. [PAID guard/transaction](../../apps/api/src/modules/payments/payments.service.ts#L231), [publish](../../apps/api/src/modules/payments/payments.service.ts#L301), [event bus](../../apps/api/src/queue/event-bus.service.ts#L31).

Online checkout còn tạo sale ledger trước payment; xem T5. Manual cancellation có nhánh reject CONFIRMED không có Payment dù đó là order request hợp lệ. [Cancel](../../apps/api/src/modules/orders/orders.service.ts#L1067). Không có provider E2E được chạy trong đợt này.

### T5 — Finance → payout → refund → delete: Partial

Seller finance UI → store-owner-scoped API → SellerLedgerEntry → payout request transaction → admin đánh dấu paid. Có sổ cái nội bộ và bookkeeping, nhưng `mark paid` chỉ ghi DB/payment metadata, **không chuyển tiền ngân hàng**. [Finance auth](../../apps/api/src/modules/finances/finances.controller.ts#L29), [request payout](../../apps/api/src/modules/stores/store-orders.service.ts#L341), [mark paid](../../apps/api/src/modules/stores/stores.service.ts#L700).

Rủi ro: online checkout insert ledger trước tạo intent; balance/payout lấy ledger chưa gắn payout mà không buộc payment đã thu. [Ledger insert](../../apps/api/src/modules/orders/orders.service.ts#L814), [intent](../../apps/api/src/modules/orders/orders.service.ts#L931), [balance](../../apps/api/src/modules/finances/finances.service.ts#L84).

Refund admin có gọi Stripe thật, không chỉ đổi status. Tuy nhiên sau refund chưa reverse seller ledger hoặc đồng bộ StoreOrder; external refund webhook chỉ cập nhật Payment. Ngược lại cancellation reverse ledger nhưng không tự refund provider. [Refund UI](../../apps/admin/src/components/payments/PaymentDetailDrawer.tsx#L169), [refund service](../../apps/api/src/modules/payments/payments.service.ts#L412), [cancel transaction](../../apps/api/src/modules/orders/orders.service.ts#L1085). Finance còn hardcode refunds/tax totals bằng 0. [Overview](../../apps/api/src/modules/finances/finances.service.ts#L142).

Order có financial history được archive và giữ records; hard delete chỉ áp dụng cancelled order không có lịch sử tài chính được nhận diện. Reversal có idempotency test đã chạy. Không tìm thấy `isTest` classification/filter tổng quát trong schema Order và các finance paths được khảo sát; không coi đề xuất cũ của người dùng là implementation hiện hữu. [Delete policy](../../apps/api/src/modules/orders/orders.service.ts#L1683), [reversal test](../../apps/api/src/modules/orders/order-ledger-reversal.spec.ts#L5).

### T6 — Shipping/fulfillment: Partial

BuyLabelModal → ownership-protected rates/purchase API → EasyPost → cập nhật order. Có mua label thật trong code, không xác minh live label. Việc update parent Order chưa đồng bộ đầy đủ StoreOrder/progress/history. [Label service](../../apps/api/src/modules/shipping/label.service.ts#L150).

Tracking webhook chỉ verify khi có secret; thiếu secret thì warning và tiếp tục nhận payload. Merchize adapter có nhánh external create thành công nhưng production push lỗi bị nuốt, worker vẫn lưu SUBMITTED. [Tracking webhook](../../apps/api/src/modules/shipping/tracking-webhook.controller.ts#L35), [Merchize](../../apps/api/src/modules/fulfillment/merchize/merchize.provider.ts#L179), [worker](../../apps/api/src/queue/fulfillment.processor.ts#L205).

Platform freeship có config mặc định $100, ghi subsidy riêng thay vì cộng vào seller revenue; có báo cáo summary/order-level. **Verified cục bộ** cho boundary/precedence/accounting helper, chưa phải đối soát chi phí carrier thực. [Policy](../../apps/api/src/modules/shipping/free-shipping-policy.ts#L1), [tests](../../apps/api/src/modules/shipping/free-shipping-policy.spec.ts#L8), [report](../../apps/api/src/modules/stores/stores.service.ts#L831).

### T7 — Messaging, notifications, moderation: Implemented/Partial

MessageThread → conversation API → user/store scope → DB message/clientMessageId → realtime/email/push và moderation queue. Có dedup message ID, read-state và fallback polling. [UI](../../apps/client/src/components/messages/MessageThread.tsx#L437), [dedup/emission](../../apps/api/src/modules/messages/messages.service.ts#L706), [unique constraint](../../prisma/schema.prisma#L2228).

Registered ownership được kiểm tra; anonymous guest thread chỉ dựa vào biết ID. Notifications feed user-scoped; FCM có token storage/cleanup. Newsletter endpoint chỉ queue welcome email, chưa thể hiện mailing-list persistence. [Guest access](../../apps/api/src/modules/messages/messages.service.ts#L209), [notification feed](../../apps/api/src/modules/notifications/notifications.service.ts#L310), [newsletter](../../apps/api/src/modules/notifications/notifications.service.ts#L274).

Moderation có provider calls nhưng lỗi provider có thể được biến thành CLEAN và cache; quota exhaustion không đảm bảo requeue. Review có purchase eligibility/duplicate prevention, nhưng public query cho phép yêu cầu HIDDEN/PENDING. [Moderation](../../apps/api/src/modules/moderation/moderation.service.ts#L334), [public reviews](../../apps/api/src/modules/reviews/reviews.service.ts#L93). Không tìm thấy dispute lifecycle/chargeback orchestration hoặc application fraud scoring hoàn chỉnh; provider-side controls bên ngoài Unknown.

### T8 — Marketing, analytics, search/SEO, international: hỗn hợp

- Buyer-offer acceptance tạo coupon cá nhân/listing-specific trong transaction; targeted campaigns có trigger và email preference kiểm tra lúc gửi. Đây là Implemented, chưa có đo uplift. [Buyer offers](../../apps/api/src/modules/marketing/buyer-offers.service.ts#L335), [targeted offers](../../apps/api/src/modules/marketing/targeted-offers.service.ts#L91), [email preferences](../../apps/api/src/queue/email.processor.ts#L49).
- Social wizard lưu post/connection DB, không OAuth/publish lên mạng xã hội. **UI Only cho chức năng xuất bản bên ngoài**. [Social service](../../apps/api/src/modules/marketing/social.service.ts#L24).
- Offsite attribution và fee có code thực, nhưng external referrer bị coi là ad; không có bằng chứng mua quảng cáo hay nguồn click trả phí được xác thực. [Tracker](../../apps/client/src/components/providers/MarketingTracker.tsx#L35), [fee](../../apps/api/src/modules/orders/orders.service.ts#L808).
- Analytics event/search-stat có DB/Redis thực; riêng Performance tab dùng random daily views, previous-period 85% và traffic split cố định. Shop stats còn cộng toàn parent order cho từng shop, listing revenue thiếu quantity. **Partial**, không phải nguồn financial truth. [Performance API](../../apps/api/src/modules/products/products.service.ts#L1393), [consumer UI](../../apps/admin/src/components/products/edit/tabs/PerformanceTab.tsx#L142), [shop totals](../../apps/api/src/modules/shop-stats/shop-stats.service.ts#L52).
- Search full-text có parameterized SQL/fallback, nhưng SQL path không áp dụng đầy đủ where filters của browsing. [SQL path](../../apps/api/src/modules/search/search.service.ts#L314), [category where](../../apps/api/src/modules/search/search.service.ts#L579).
- SEO metadata/JSON-LD/canonical/hreflang có implementation; indexing/ranking Unknown. UI locale en/vi/zh và provider translation có code, không chứng minh toàn bộ nội dung được dịch đúng. Currency service hỗ trợ USD/VND với fallback rate cố định; không tương đương multi-currency settlement hay tax/duties compliance. [SEO helper](../../apps/client/src/lib/seo.ts#L7), [locale config](../../apps/client/src/i18n/routing.ts#L16), [currency](../../apps/api/src/modules/currency/currency.service.ts#L4).
- Plus/subscriptions hiện là admin grant/extend/revoke với kỳ hạn và entitlement, chưa phải recurring billing tự động. [Subscription service](../../apps/api/src/modules/subscriptions/subscriptions.service.ts#L26).

### T9 — Affiliate commission và payout: Partial

Affiliate portal có request payout thật → API kiểm tra account/balance → transaction tạo request và trừ balance; admin endpoint gọi `markPayoutPaid` để lưu PAID/notes, không gọi dịch vụ chuyển tiền. Đây là đường đang được controller dùng, không suy từ một method khác cùng tên nghiệp vụ rằng tiền bị trừ hai lần. [Portal UI](<../../apps/client/src/app/[locale]/(storefront)/affiliate/(portal)/payouts/page.tsx#L63>), [request service](../../apps/api/src/modules/affiliates/portal.service.ts#L185), [admin route](../../apps/api/src/modules/affiliates/admin-affiliates.controller.ts#L76), [mark paid](../../apps/api/src/modules/affiliates/admin-affiliates.service.ts#L296).

Có click attribution với dedup một giờ, commission/order, delayed confirmation và refund cancellation handling. Tuy nhiên request payout đọc/check balance trước transaction rồi decrement không có predicate số dư; hai request đồng thời có thể cùng vượt qua check. Admin mark-paid đổi **toàn bộ** CONFIRMED commission của affiliate sang PAID, không phân bổ theo số tiền payout một phần. [Tracking](../../apps/api/src/modules/affiliates/affiliate-tracking.service.ts#L30), [commission](../../apps/api/src/modules/affiliates/commission.service.ts#L25), [balance update](../../apps/api/src/modules/affiliates/portal.service.ts#L211), [commission updateMany](../../apps/api/src/modules/affiliates/admin-affiliates.service.ts#L319). Đây là static findings, chưa chạy concurrency test; click dedup không phải hệ thống antifraud.

## 4. Vận hành, kiểm thử và khả năng mở rộng

**Điểm có giá trị:** CI lint/typecheck/unit/build/E2E và dependency audit; Docker publish có quality gate, deploy ưu tiên image SHA, migration fail thì dừng trước restart. Nhánh fallback `latest` bị vô hiệu bằng `FALLBACK_TARGETS=""`; không kết luận từ comment cũ rằng đang fallback latest. [CI](../../.github/workflows/ci.yml#L43), [publish gate](../../.github/workflows/docker-publish.yml#L104), [deploy](../../scripts/deploy.sh#L302).

**Giới hạn:** health API trả object `degraded` vẫn HTTP thành công, storage hardcoded ok, chưa probe Mongo/provider; deploy health dùng wget bỏ body nên có thể chấp nhận degraded. [Health](../../apps/api/src/health/health.controller.ts#L35), [deployment check](../../scripts/deploy.sh#L425). Redis cache client không reconnect và dùng KEYS khi invalidate; không suy rộng chính sách đó sang connection riêng của BullMQ. [Redis](../../apps/api/src/common/services/redis.service.ts#L17).

Queue có retry/backoff/job IDs và dead-job marker, nhưng alert email dùng cùng queue infrastructure; dedup queue không thay thế idempotency bền vững tại DB khi replay hoặc job đã bị prune. Axiom chỉ gửi warn/error best-effort, Sentry phụ thuộc env. Chưa xác minh alert routing/SLO, backup/restore drill, RPO/RTO hoặc tải. [Queue options](../../apps/api/src/queue/queue.constants.ts#L74), [dead job](../../apps/api/src/queue/dead-job-alert.ts#L44), [logging](../../apps/api/src/common/services/axiom-logger.service.ts#L54).

### Kết quả chạy ngày 01/10/2026

Chạy qua Nx với `NX_DAEMON=false`, `--skipNxCache`; không dùng cache cũ. Node local `24.14.0` thấp hơn engine khai báo `>=24.15.0 <25`, pnpm `11.5.2`; đây là giới hạn môi trường, dù các lệnh sau exit 0.

| Lệnh | Kết quả | Không chứng minh |
|---|---|---|
| `pnpm nx run-many -t typecheck -p api client admin --parallel=1 --skipNxCache` | PASS cả 3 project | Runtime correctness, production bundle hoặc deployment |
| `pnpm nx run api:test --runInBand --testPathPatterns='pricing.util.spec\|free-shipping-policy.spec\|order-ledger-reversal.spec\|auth-sessions.spec\|product-store-write.guard.spec' --skipNxCache` | **5 suites, 38 tests PASS**, Jest 84.459 giây | Provider/DB integration, MFA challenge isolation, concurrency hoặc tất cả finance flows |

Các test sử dụng unit/mocks; nhãn Verified chỉ gắn với assertions được chạy. Chưa chạy full unit suite, coverage, lint, build hoặc browser E2E trong đợt đánh giá này. Nx daemon gặp lỗi graph ở lần discovery nhưng CLI fallback trả config; các checks sau chạy không daemon.

Coverage threshold cấu hình API là statements/lines 25%, branches/functions 3%, **không phải coverage đo được**. Playwright hiện có desktop Chromium/Pixel 5, account settings và checkout dùng API mock. Không coi đó là E2E với backend/gateway thật. [Jest config](../../apps/api/jest.config.ts#L10), [Playwright config](../../apps/client/playwright.config.ts#L29), [mock test](../../apps/client/e2e/account-settings.spec.ts#L14).

## 5. Hồ sơ cần bổ sung để nâng mức xác minh

1. Build SHA đang chạy, cấu hình provider đã che secrets, webhook delivery logs và smoke test có kiểm soát.
2. Transaction sandbox/live nhỏ được phê duyệt: captured → fulfilled → refunded → seller ledger → bank payout, với chứng từ đối soát.
3. Negative auth/tenant tests, multi-store totals, stock concurrency/replay, provider timeout và queue-down injection.
4. Restore drill PostgreSQL + Mongo + assets; release rollback có kiểm tra tương thích migration; SLO và cảnh báo ngoài queue.
5. Dữ liệu cohort được tách test/manual/unpaid/refunded, kèm từ điển metric. Trước đó không dùng dashboard làm số liệu gọi vốn.

Các bước trên là đề xuất, **chưa được thực thi**. Báo cáo không thay đổi bất kỳ finding nào trong source.
