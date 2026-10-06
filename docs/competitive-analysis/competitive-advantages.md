# 03 — Lợi thế cạnh tranh: phân loại A/B/C/D

> Cập nhật 02/10/2026: nội dung bên dưới giữ làm baseline audit 01/10, không phải trạng thái code mới nhất. Đã có các bản sửa local về identity, draft/review access, webhook, provider failure, affiliate concurrency, search và số lượng trong revenue. Xem [re-audit từng finding](../production-hardening/final-re-audit.md), [kết quả kiểm thử](../production-hardening/progress.md) và [pilot readiness](../production-hardening/pilot-readiness.md). Chưa deploy/chạy giao dịch thật; không nâng claim cạnh tranh, traction hoặc doanh thu. Các vấn đề tiền, Google MFA và guest messaging còn chặn paid pilot.

Ngày: **01/10/2026**. Căn cứ: [technical audit](technical-audit.md), [feature matrix và nguồn chính thức](feature-matrix.md). Đây là đánh giá tại working tree, không phải xác nhận năng lực production.

## Kết luận

**EziHubb hiện chưa có lợi thế cạnh tranh thuộc nhóm A được kiểm chứng.** Có tài sản kỹ thuật và một số workflow tạo cơ sở thử nghiệm định vị; chưa có dữ liệu cho thấy conversion, retention, chi phí hoặc chất lượng vượt phương án thay thế.

Không đồng nhất ba điều: “đã xây”, “khác biệt trong cách đóng gói sản phẩm”, và “khách hàng được lợi hơn theo số liệu”. Cũng không coi tự viết source code, số module, AI API hay giao diện giống Etsy là rào cản sao chép.

## A — Verified Competitive Advantage

**Chưa có mục đủ bằng chứng.** Thiếu cả benchmark khách hàng lẫn cohort kinh tế: seller activation/time-to-first-sale, successful paid conversion, contribution margin, repeat purchase, support/rework cost và switching cost. Unit tests xác minh logic, không xác minh lợi thế cạnh tranh.

## B — Product Differentiation đã có workflow

“Differentiation” ở đây là cách chọn và kết hợp workflow của EziHubb, **không tuyên bố độc quyền hoặc đối thủ không có**.

### B1. Quy trình thương lượng gắn với sản phẩm, người mua và coupon một lần

- **Bằng chứng:** chấp nhận/counter offer có transition có điều kiện, expiry và coupon buyer/listing-specific trong transaction. [BuyerOffersService](../../apps/api/src/modules/marketing/buyer-offers.service.ts#L335).
- **Người hưởng lợi/vấn đề:** seller custom-order cần chốt giá và chuyển thỏa thuận thành giỏ hàng; buyer không phải nhập lại điều kiện đã thống nhất.
- **Giá trị giả thuyết:** giảm thất thoát từ conversation sang checkout, giảm nhập tay/nhầm mức giảm giá. Chưa đo được tác động.
- **Đối chứng:** Etsy đã có custom request/private listing; vì vậy không được pitch “thương lượng riêng là tính năng mới của thị trường”. [Etsy E1, kiểm tra 01/10/2026](https://help.etsy.com/hc/en-us/articles/115015440167-How-to-Request-a-Personalized-or-Custom-Item).
- **KPI:** offer → accepted, accepted → paid (không chỉ request), median thời gian chốt, lỗi coupon, net margin sau giảm giá; phân tách từ chối và hết hạn.
- **Khả năng sao chép:** cao; code không tạo network effect. Có thể hình thành switching cost nếu lịch sử công việc/mẫu báo giá giúp seller tiết kiệm thời gian, nhưng hiện là giả thuyết.
- **Độ chắc chắn:** cao về implementation; thấp về lợi ích thương mại. Chỉ thử với workflow đã sửa các lỗi auth/payment liên quan.

### B2. Platform shipping support có cấu hình và sổ chi phí riêng

- **Bằng chứng:** threshold mặc định $100, helper tách platform subsidy khỏi seller revenue, báo cáo theo đơn và tổng. Unit tests boundary/precedence đã PASS cục bộ. [Policy](../../apps/api/src/modules/shipping/free-shipping-policy.ts#L1), [tests](../../apps/api/src/modules/shipping/free-shipping-policy.spec.ts#L8), [report](../../apps/api/src/modules/stores/stores.service.ts#L831).
- **Người hưởng lợi/vấn đề:** platform muốn biết chi phí kích thích mua và buyer muốn tổng tiền rõ; seller không nhận nhầm phần phí ship đã được miễn.
- **Giá trị giả thuyết:** thử threshold/bundle để tăng basket size; đồng thời kiểm soát ngân sách subsidy. Không được coi subsidy là doanh thu hoặc tăng trưởng tự tài trợ.
- **Đối chứng:** chưa benchmark chính xác chương trình hỗ trợ phí ship của từng đối thủ; **không có bằng chứng cơ chế này là độc nhất**. Xét freeship nói chung thì là Feature Parity; điểm B chỉ là workflow kiểm soát chi phí được đóng gói trong EziHubb.
- **KPI:** incremental paid conversion/AOV so với holdout, subsidy mỗi đơn đã giao, contribution margin sau subsidy, đơn bị hủy/hoàn, chênh lệch quote với carrier invoice.
- **Khả năng sao chép:** cao. Tối ưu dựa trên dữ liệu và hợp đồng vận chuyển mới có thể tạo lợi thế; chưa có bằng chứng về hai yếu tố đó.
- **Độ chắc chắn:** cao với logic helper, trung bình với end-to-end accounting, thấp với uplift/defensibility.

## C — Potential Advantage cần hoàn thiện/kiểm chứng

| Giả thuyết | Tài sản đang có | Khoảng trống/phụ thuộc | KPI và cơ chế bảo vệ tiềm năng |
|---|---|---|---|
| C1. Bộ vận hành custom gifts theo ngách, ít thao tác nối công cụ | Variant transaction, custom inputs, conversation, buyer offers và provider adapters — [T2/T3/T6/T7](technical-audit.md) | Demo-only graphical renderer; inventory, payment reliability; chưa có seller benchmark hoặc print-quality QA | Phút/listing, phút/order, lỗi artwork/reprint, seller retention. Moat chỉ có thể đến từ SOP/template có quyền sử dụng, supplier quality và dữ liệu lỗi đã xử lý |
| C2. Hỗ trợ seller nói tiếng Việt phục vụ buyer quốc tế | en/vi/zh, entity translations, store/order split — [routing](../../apps/client/src/i18n/routing.ts#L16), [schema](../../prisma/schema.prisma#L687) | Chất lượng dịch, live settlement, tax/duties, seller onboarding và SLA xuyên biên giới đều chưa được chứng minh | Activation theo cohort seller, order defect/late rate, support cost, repeat buyer. Dịch UI đơn thuần dễ sao chép |
| C3. Distribution từ web nail hiện có | Người dùng cho biết có traffic ổn định; chưa có analytics export/link funnel xác minh | Audience overlap với quà cá nhân hóa chưa biết; click không đồng nghĩa demand; cần consent, đúng ngữ cảnh, attribution không coi mọi referral là paid ad | Qualified visits → request → paid → delivered → repeat; contribution sau chi phí cơ hội vị trí banner. Audience relationship thật có thể khó sao chép hơn code, nhưng hiện **Unknown** |
| C4. Insights từ hành vi mua/tìm kiếm trong một ngách | SearchTermDailyStat, saved search, listing-price sample — [insights](../../apps/api/src/modules/marketplace-insights/marketplace-insights.service.ts#L96) | Data volume/quality chưa biết; sample không đại diện toàn thị trường; analytics có lỗi/synthetic data | Seller quyết định tốt hơn so với baseline, fewer zero-result sessions, incremental sales. Data moat chỉ xuất hiện khi đủ độc quyền/chất lượng và có tác động đo được |

Đối chứng quan trọng cho C1: [Teeinblue](https://apps.shopify.com/teeinblue) đã công bố live preview, production files và gửi đơn tới POD; [Amazon Custom](https://sell.amazon.com/programs/custom) hỗ trợ text/image/options. Kiểm tra 01/10/2026. Do đó “AI personalization” hoặc “POD integration” nói chung không đủ tạo lợi thế.

## D — Feature Parity, không quảng bá như moat

| Năng lực | Bằng chứng EziHubb | Cách diễn đạt đúng |
|---|---|---|
| Catalog/variants/storefront | [ProductsService](../../apps/api/src/modules/products/products.service.ts#L299) | Năng lực nền tảng; không chứng minh tốt hơn catalog của đối thủ |
| Personalization input | [PurchasePanel](../../apps/client/src/components/product/ProductPurchasePanel.tsx#L1039) | Có thể thu yêu cầu tùy chỉnh; Etsy/Amazon/app cũng có — [matrix](feature-matrix.md) |
| Seller dashboard, metrics | [ShopStatsService](../../apps/api/src/modules/shop-stats/shop-stats.service.ts#L52) | Có dashboard, nhưng metric cần sửa; eBay Seller Hub là đối chứng [B2](https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095), kiểm tra 01/10/2026 |
| Reviews/messages/promotions | [ReviewsService](../../apps/api/src/modules/reviews/reviews.service.ts#L175), [MessagesService](../../apps/api/src/modules/messages/messages.service.ts#L706) | Cần cho trust/conversion; có UI không tương đương buyer protection |
| Stripe/PayPal integration | [PaymentsService](../../apps/api/src/modules/payments/payments.service.ts#L235) | Adapter có thực; chưa chứng minh live processing và reconciliation |
| RBAC, session history, CI | [session validation](../../apps/api/src/modules/auth/validate-session.ts#L5), [CI](../../.github/workflows/ci.yml#L43) | Tài sản engineering, là hygiene cần có; còn lỗi auth nên không gọi “security advantage” |
| SEO, i18n | [SEO helper](../../apps/client/src/lib/seo.ts#L7), [locale routing](../../apps/client/src/i18n/routing.ts#L16) | Hỗ trợ discoverability/localization; ranking/traffic/coverage chưa được chứng minh |

## Cách nâng C/B thành A

1. Chọn một phân khúc và một phương án thay thế cụ thể, không so với “toàn bộ Etsy”.
2. Hoàn thiện các release gates trong [risk register](gaps-and-risks.md); metric phải dựa trên payment/fulfillment có đối soát, không synthetic charts.
3. Thu baseline, nhóm so sánh hoặc thử nghiệm có kiểm soát. Báo numerator/denominator, thời gian, nguồn traffic, loại seller và confidence interval khi mẫu đủ.
4. Chứng minh cải thiện có lặp lại, không chỉ nhờ giảm giá/trợ giá hoặc thao tác tay của founder. Tính đủ support, refund, reprint, gateway, subsidy và acquisition.
5. Kiểm tra tính bảo vệ: hợp đồng supplier, template/IP có quyền sử dụng, workflow switching cost hoặc acquisition channel khó mua lại; không suy “network effect” từ việc có nhiều shop trong schema.

Cho đến lúc đó, cách diễn đạt trung thực là: **“EziHubb đã xây nền tảng để thử nghiệm một marketplace custom gifts được tuyển chọn; lợi thế kinh doanh vẫn cần chứng minh.”**
