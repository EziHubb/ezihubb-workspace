# 04 — Gaps & risks

> Cập nhật 02/10/2026: nội dung bên dưới giữ làm baseline audit 01/10, không phải trạng thái code mới nhất. Đã có các bản sửa local về identity, draft/review access, webhook, provider failure, affiliate concurrency, search và số lượng trong revenue. Xem [re-audit từng finding](../production-hardening/final-re-audit.md), [kết quả kiểm thử](../production-hardening/progress.md) và [pilot readiness](../production-hardening/pilot-readiness.md). Chưa deploy/chạy giao dịch thật; không nâng claim cạnh tranh, traction hoặc doanh thu. Các vấn đề tiền, Google MFA và guest messaging còn chặn paid pilot.

Ngày: **01/10/2026**. Baseline và kết quả chạy trong [technical audit](technical-audit.md). Đây là risk register từ source inspection, không phải báo cáo sự cố production. Không khai thác lỗ hổng, sửa code hay thay đổi cấu hình trong đợt này.

## 1. Thang ưu tiên

- **P0:** chặn mở rộng vận hành cho đến khi kiểm chứng/sửa; tác động lớn đến identity, dữ liệu hoặc tiền.
- **P1:** cần xử lý trước pilot trả tiền/multi-store không giám sát; ưu tiên theo điều kiện kích hoạt.
- **P2:** cần kế hoạch khắc phục và theo dõi, không tự suy thành blocker toàn sản phẩm.

Severity là đánh giá tác động có điều kiện, không phải xác suất khai thác hoặc số tiền đã mất. “Cao về code” nghĩa đường xử lý được nhìn thấy; **deployment, occurrence và exposure thực tế vẫn Unknown** nếu chưa có runtime evidence.

## 2. Rủi ro identity và quyền riêng tư

### R01 — P0 / Critical: token MFA challenge được nhận như access token

**Bằng chứng:** token chờ TOTP dùng cùng access secret, mang role/sub/email nhưng không sid; JWT validation không kiểm tra purpose; legacy sidless path vẫn hợp lệ nếu không bị global revocation. MFA confirm còn cho phép thay secret mới mà không xác minh factor đang dùng. [Token](../../apps/api/src/modules/auth/auth.service.ts#L713), [validation](../../apps/api/src/modules/auth/strategies/jwt.strategy.ts#L36), [legacy branch](../../apps/api/src/modules/auth/validate-session.ts#L23), [TOTP replacement](../../apps/api/src/modules/auth/auth.service.ts#L247).

**Điều kiện/tác động:** người đã biết password của tài khoản cần MFA có thể nhận challenge 5 phút; phân tích tĩnh cho thấy challenge vượt mục đích dự kiến trên protected APIs, kể cả privileged role. Không khẳng định ai đã dùng cách này trên production. HTTP expiry, deleted-user check và global revocation có tồn tại nhưng không sửa type confusion.

**Đề xuất, chưa thực hiện:** tách purpose/audience hoặc signing key; chỉ access token có session hợp lệ mới vào protected HTTP/realtime; yêu cầu reauthentication/factor cũ khi thay MFA. Acceptance: challenge bị từ chối trên toàn bộ protected routes và realtime, không thể thay factor; full authenticated flow vẫn chạy. Bổ sung negative tests guard chain, không chỉ test helper session.

### R02 — P0 / High: nhận dữ liệu guest theo email chưa xác minh

Registration nối guest orders/conversations trước verification, rồi trả full session. Các endpoint `orders/me`/conversation lấy theo user ownership sau khi đã link. [Register](../../apps/api/src/modules/auth/auth.service.ts#L68), [link matching](../../apps/api/src/modules/auth/auth.service.ts#L700), [order listing](../../apps/api/src/modules/orders/orders.service.ts#L960).

Điều kiện: email chưa có account nhưng có guest history. Không phải arbitrary takeover tài khoản đã đăng ký. Tác động có thể gồm lịch sử mua, địa chỉ và nội dung trao đổi. Chỉ claim guest records sau verified mailbox hoặc one-time credential bound đúng records. Acceptance: đăng ký email chưa verify không nhìn thấy guest history; verify đúng người mới link, replay không nhân đôi/mất dữ liệu.

### R03 — P1 / High: chính sách MFA khác nhau theo login method

Google identity được verify, nhưng `buildGoogleAuthResponse` phát full token mà không áp TOTP gate của password login. [Google response](../../apps/api/src/modules/auth/auth.service.ts#L604). Đây là policy gap đối với tài khoản bật MFA, không phải bằng chứng Google identity có thể giả mạo. Chuẩn hóa pipeline sau primary authentication; test password/Google cho cùng tài khoản, kể cả administrator.

### R04 — P1 / High: bearer-ID access cho draft và guest thread

`draft/:draftId` trả draft không kiểm tra user/session/expiry; guest conversation access chấp nhận anonymous nếu thread chưa có userId. [Draft](../../apps/api/src/modules/customization/customization.service.ts#L293), [guest access](../../apps/api/src/modules/messages/messages.service.ts#L209).

Biết ID là điều kiện; không kết luận có enumeration thực tế. Khi URL/log/referrer làm lộ ID, dữ liệu có thể được đọc hoặc guest chat bị can thiệp. Dùng capability token ngẫu nhiên riêng có scope/expiry hoặc ràng buộc guest session; không coi ID database là authorization. Test cross-account, anonymous, expired draft, revoked guest link và attachment access.

### R05 — P1 / Medium: public reviews cho lọc HIDDEN/PENDING

Public route nhận DTO ReviewStatus và service dùng status từ query. [Service](../../apps/api/src/modules/reviews/reviews.service.ts#L93), [DTO](../../apps/api/src/modules/reviews/dto/review-query.dto.ts#L7). Khóa APPROVED trong public service path; admin dùng DTO/route khác. Acceptance: mọi query public không trả review chưa công bố.

### R06 — P1 / Medium: quyền cũ còn tồn tại sau demotion

Admin team update role không revoke sessions; guard tiếp tục tin role trong access token. [Role update](../../apps/api/src/modules/admin/admin-team.controller.ts#L165), [JWT return](../../apps/api/src/modules/auth/strategies/jwt.strategy.ts#L46). Thời gian cửa sổ phụ thuộc TTL token. Revoke hoặc auth-version check trên thay quyền; test token phát trước demotion bị từ chối ngay theo policy đã chọn.

## 3. Tiền, tồn kho và thực hiện đơn

### R07 — P0 khi bật online payments / High: unpaid sale vào available payout balance

Checkout online ghi ledger khi order còn PENDING_PAYMENT, trước provider intent. Balance/payout chọn ledger chưa payout, không lọc payment đã thu; điều kiện order status ở payout path chỉ dùng đếm số order. [Create ledger](../../apps/api/src/modules/orders/orders.service.ts#L732), [insert](../../apps/api/src/modules/orders/orders.service.ts#L814), [payout selection](../../apps/api/src/modules/stores/store-orders.service.ts#L341).

**Không đồng nghĩa hệ thống đã tự chuyển tiền sai**: payout hiện là bookkeeping/manual. Nhưng số available có thể khiến operator chi sai. Định nghĩa rõ pending/available/settled ledger; chỉ release theo captured + policy hold, idempotent trong transaction. Acceptance: declined, abandoned, expired, duplicate và cancelled checkouts không tăng payable; tổng ledger đối soát được provider.

### R08 — P0 trước paid pilot / High: DB commit và event publish không nguyên tử

Stripe commit PAID rồi publish Redis; publish lỗi, retry return vì đã PAID. PayPal webhook có pattern tương tự. [Stripe](../../apps/api/src/modules/payments/payments.service.ts#L231), [publish](../../apps/api/src/modules/payments/payments.service.ts#L301), [PayPal](../../apps/api/src/modules/payments/payments.service.ts#L886).

Có retry/job ID nhưng chưa thấy outbox/reconciliation cho event chưa vào queue. Đề xuất transactional outbox + dispatcher, consumer idempotency và reconciliation sweep. Acceptance: kill process/Redis unavailable ở ranh giới commit–publish vẫn phục hồi đủ seller status, inventory, commission và notification; không double-credit khi replay.

### R09 — P0 trước refund/payout thật / High: refund, cancel, seller ledger không đồng bộ

Stripe refund gọi provider thật nhưng thiếu seller-ledger reversal/StoreOrder sync; external refund chỉ update Payment. Cancellation reverse ledger nhưng không hoàn tiền provider. Finance refunds hardcoded 0. [Refund](../../apps/api/src/modules/payments/payments.service.ts#L412), [external refund](../../apps/api/src/modules/payments/payments.service.ts#L323), [cancel](../../apps/api/src/modules/orders/orders.service.ts#L1085), [finance](../../apps/api/src/modules/finances/finances.service.ts#L142).

Đề xuất state machine refund riêng, provider idempotency key bền vững, amount reconciliation và ledger adjustments theo đúng số thực thu/hoàn. Acceptance: full/partial/multiple refunds, external dashboard refund, retry sau provider-success/DB-failure, refund sau payout; số payable/net revenue phản ánh đúng và audit trail giữ nguyên.

### R10 — P1 / High: inventory không an toàn khi nhiều dòng/replay/concurrency

Checkout không reserve/check sufficient quantity trong path đã trace. Sau payment, processed-set skip các dòng trùng product; product stock decrement không có marker bền vững, không cập nhật variant quantity. [Checkout](../../apps/api/src/modules/orders/orders.service.ts#L253), [stock](../../apps/api/src/modules/products/low-stock.service.ts#L57).

Đề xuất chọn rõ unlimited/made-to-order vs stock-managed; reserve/consume/release theo SKU bằng atomic condition; sum các order lines; persistent idempotency. Acceptance: hai buyer tranh last unit, hai variant/custom lines cùng product, duplicate payment event và cancellation không tạo âm stock/double-decrement.

### R11 — P1 / High, phụ thuộc env: tracking webhook fail-open

Thiếu `EASYPOST_WEBHOOK_SECRET` chỉ warning, không reject; payload có tracking number đã biết có thể update delivery. [Controller](../../apps/api/src/modules/shipping/tracking-webhook.controller.ts#L35). Env production Unknown. Fail closed theo môi trường, verify signature/replay và provider fetch khi thích hợp; test missing/wrong secret không mutate order.

### R12 — P1 / Medium: order state khác nhau giữa parent/shop/provider

- Manual CONFIRMED không Payment bị buyer cancel reject. [OrdersService](../../apps/api/src/modules/orders/orders.service.ts#L1067).
- Digital payment đặt parent COMPLETED nhưng worker chỉ confirm shop orders khi parent CONFIRMED. [Payment](../../apps/api/src/modules/payments/payments.service.ts#L260), [worker](../../apps/api/src/queue/order.processor.ts#L328).
- Label purchase update parent SHIPPED mà không cùng cập nhật StoreOrder/progress/history. [Label](../../apps/api/src/modules/shipping/label.service.ts#L169).
- Merchize production-push failure bị catch, sau đó vẫn trả submitted. [Provider](../../apps/api/src/modules/fulfillment/merchize/merchize.provider.ts#L179).

Đề xuất state transitions tập trung, audit history và compensation theo substep; kiểm thử manual/physical/digital/multi-store. Một job “success” không được che thất bại bước sản xuất.

### R13 — P1 / Medium: test-data exclusion chưa thành chính sách thực thi

Order schema có archival fields và retention logic; không thấy `isTest` filter toàn hệ thống. [Schema](../../prisma/schema.prisma#L1549), [archive policy](../../apps/api/src/modules/orders/orders.service.ts#L1683). Không nên “xóa finance history” để làm sạch dashboard. Cần phân loại test/production ở nguồn phát sinh và metric views, giữ audit/settlement records, đối soát legacy data trước sửa. Việc này chưa được triển khai trong audit.

## 4. Chất lượng sản phẩm, measurement và vận hành

| ID / ưu tiên | Phát hiện có bằng chứng | Tác động / hướng kiểm chứng |
|---|---|---|
| R14 / P1 | Product Performance dùng random views, previous-period 85%, traffic split cố định; [source](../../apps/api/src/modules/products/products.service.ts#L1393) | Không dùng chart làm traction. Bỏ synthetic hoặc gắn rõ ước lượng; đo đúng events và reconcile trước pitch |
| R15 / P1 | Shop revenue cộng parent Order.total cho mỗi shop; listing sum unitPrice thiếu quantity; [source](../../apps/api/src/modules/shop-stats/shop-stats.service.ts#L52), [listing](../../apps/api/src/modules/shop-stats/shop-stats.service.ts#L398) | Sai multi-store/statistics. Test order hai shop, qty >1, discount/refund/tax/shipping phân bổ |
| R16 / P1 | External referrer được phân loại offsite ad rồi có thể thành seller fee; [tracker](../../apps/client/src/components/providers/MarketingTracker.tsx#L35), [fee](../../apps/api/src/modules/orders/orders.service.ts#L808) | Billing provenance chưa đủ. Chỉ charge click campaign được xác thực/đúng hợp đồng, phân biệt organic/referral/paid; kiểm tra landing → conversion |
| R17 / P1 | Moderation provider lỗi trả CLEAN và cache; quota path return làm job hoàn tất; [text](../../apps/api/src/modules/moderation/text-moderation.service.ts#L63), [cache](../../apps/api/src/modules/moderation/moderation.service.ts#L334) | Outage không phải nội dung an toàn. Dùng UNKNOWN/PENDING + backoff, human queue, monitored retry; test provider timeout/quota |
| R18 / P1 | Full-text SQL bỏ một số category/attribute filters; [SQL](../../apps/api/src/modules/search/search.service.ts#L314), [where](../../apps/api/src/modules/search/search.service.ts#L579) | Buyer nhận kết quả sai; tests parity giữa browse và q search cho từng filter, pagination/facets |
| R19 / P2 | General preview chỉ DEMO_TEMPLATE; BG removal fallback vẫn done; [preview](../../apps/api/src/modules/customization/customization.service.ts#L178), [worker](../../apps/api/src/queue/image.processor.ts#L65) | Sai kỳ vọng sản phẩm. Template authoring/render/print validation; lỗi provider phải hiển thị trung thực |
| R20 / P1 vận hành | Health HTTP thành công dù degraded; storage hardcoded; deploy bỏ response body; [health](../../apps/api/src/health/health.controller.ts#L35), [deploy](../../scripts/deploy.sh#L425) | Deploy có thể xanh khi dependency hỏng. Liveness/readiness tách rõ, assert dependency status/version; alert độc lập |
| R21 / P2 | Redis cache không reconnect; invalidate dùng KEYS; [source](../../apps/api/src/common/services/redis.service.ts#L17) | Mất cache kéo dài/load tăng; verify recovery, SCAN-based invalidation hoặc version keys. Không kết luận BullMQ dùng cùng retry policy |
| R22 / P1 trước scale | Chưa thấy restore/load/SLO evidence; best-effort Axiom và queue-dependent alert; [logger](../../apps/api/src/common/services/axiom-logger.service.ts#L54), [alert](../../apps/api/src/queue/dead-job-alert.ts#L44) | Cần restore drill, observability runbook, outage exercise; không khẳng định production không có backup ngoài repo |
| R23 / P2 | Social publish chỉ DB; newsletter chỉ welcome email; [social](../../apps/api/src/modules/marketing/social.service.ts#L24), [newsletter](../../apps/api/src/modules/notifications/notifications.service.ts#L274) | Không hứa kênh tự động/subscriber retention. Gắn nhãn trạng thái, triển khai provider/subscriber lifecycle nếu thực sự cần |
| R24 / P1, finance | Affiliate payout check balance trước transaction; decrement không điều kiện; admin payout đổi mọi CONFIRMED commission sang PAID dù payout có thể một phần. [Request](../../apps/api/src/modules/affiliates/portal.service.ts#L185), [mark paid](../../apps/api/src/modules/affiliates/admin-affiliates.service.ts#L319) | Concurrent requests có thể overdraw; partial payout thiếu allocation chính xác. Cần conditional debit/locking, payout-to-commission allocations, replay/concurrency tests; chưa có bằng chứng xảy ra ngoài thực tế |

Logs có URL/IP/user-agent và dead-job payload; cần review redaction, retention và access trước đưa dữ liệu buyer vào log backend. [HTTP logger](../../apps/api/src/common/interceptors/logging.interceptor.ts#L20), [dead job data](../../apps/api/src/queue/dead-job-alert.ts#L61). Account export/anonymization có implementation nhưng chưa chứng minh bao phủ mọi attachment/conversation/processor. [UsersService](../../apps/api/src/modules/users/users.service.ts#L95).

## 5. Khoảng trống kinh doanh: giả thuyết, không phải bug đã xác minh

| Vấn đề | Điều chưa biết | Bằng chứng cần thu / hành động đề xuất |
|---|---|---|
| Marketplace hai phía | Bao nhiêu seller độc lập, bao nhiêu listing có khả năng giao đúng; lượng buyer phù hợp | Cohort seller activation, first paid sale, repeat seller; phân biệt shop của founder với nguồn cung độc lập |
| Liquidity | Buyer tìm được món muốn mua hay chỉ browse | Zero-result rate, qualified-session → paid, thời gian tìm/đặt, seller response và order acceptance theo ngách |
| Distribution web nail | Quy mô, geographic mix, intent và quyền sử dụng audience chưa có dữ liệu | Analytics export đã giảm PII; contextual banner pilot có holdout; không mặc định cùng người xem nail sẽ mua ornaments |
| Trust/buyer protection | Ai chịu trách nhiệm khi sai artwork, hàng trễ, seller mất liên lạc; ngân sách hoàn/đền | SOP, dispute case owner, SLA, evidence upload, refund reserve; không dùng badge để thay quy trình |
| Seller quality/IP | Chưa có hồ sơ xét duyệt, quyền sử dụng artwork/font/photo hoặc takedown workflow hoàn chỉnh được chứng minh | Onboarding checklist, sample-order QA, giấy phép asset, moderation human-review và escalation |
| Cross-border payments | Live merchant onboarding, payout corridors/currency, settlement và chargeback operations chưa kiểm chứng | Xác nhận provider và chuyên gia phù hợp cho thị trường đã chọn; small controlled transaction + refund/payout reconciliation |
| Unit economics | GMV paid, take rate thực, CAC, COGS, support/reprint/refund/subsidy chưa có | Model theo cohort, chứng từ chi phí, contribution margin, phân biệt platform và store sở hữu inventory |
| Tuân thủ | Target country/entity, thuế, dữ liệu cá nhân, marketing consent, consumer returns và IP duties chưa chốt | Rà soát chuyên môn theo pháp nhân/thị trường; báo cáo này **không kết luận tuân thủ hay đưa ý kiến pháp lý** |

## 6. Release gates đề xuất

1. **Identity gate:** đóng R01/R02, negative tests và review độc lập. Chưa qua thì không mở rộng lưu trữ dữ liệu thật hoặc onboarding privileged users.
2. **Money gate:** capture/refund/cancel/payout reconciled; không unpaid balance; fault injection R07–R09. Trước đó giữ manual/request mode nếu đó là cấu hình vận hành được chủ hệ thống chọn, diễn đạt rõ chưa thu tiền.
3. **Order gate:** inventory, multi-store progress, signature verification và provider retries có test failure-path; order delivered phải có bằng chứng.
4. **Measurement gate:** không synthetic charts trong business reporting, metric definitions, exclude test/unpaid và reconciliation; chỉ sau đó dùng số liệu cho growth/investor.
5. **Ops gate:** restore thực nghiệm, alarms ngoài Redis, on-call owner và rollback rehearsal. Không dùng CI PASS làm bằng chứng gate này.

38 unit tests PASS trong đợt này không đóng các gate trên. Ưu tiên thực hiện theo [roadmap](strategic-roadmap.md); mọi sửa chữa vẫn cần task triển khai riêng, audit không tự thay source.
