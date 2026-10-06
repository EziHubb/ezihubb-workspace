# 05 — Strategic roadmap: 30/60/90 ngày

> Cập nhật 02/10/2026: nội dung bên dưới giữ làm baseline audit 01/10, không phải trạng thái code mới nhất. Đã có các bản sửa local về identity, draft/review access, webhook, provider failure, affiliate concurrency, search và số lượng trong revenue. Xem [re-audit từng finding](../production-hardening/final-re-audit.md), [kết quả kiểm thử](../production-hardening/progress.md) và [pilot readiness](../production-hardening/pilot-readiness.md). Chưa deploy/chạy giao dịch thật; không nâng claim cạnh tranh, traction hoặc doanh thu. Các vấn đề tiền, Google MFA và guest messaging còn chặn paid pilot.

Ngày lập: **01/10/2026**. Đây là đề xuất, không phải các công việc đã triển khai hay dự báo tăng trưởng. Lộ trình tính từ ngày bắt đầu thực hiện; milestone phụ thuộc release gates, không phải cứ qua ngày là được mở traffic.

## Khuyến nghị chính

**Ưu tiên một marketplace custom gifts được tuyển chọn trong một ngách nhỏ**, dùng founder-operated store để kiểm chứng demand/operations, rồi mới thêm seller độc lập. Kênh web nail là giả thuyết acquisition cần đo, không phải bằng chứng product–market fit. Không chạy đồng thời cả ba chiến lược dưới đây.

Nền tảng đã có catalog/custom inputs, order requests, chat, offers và các cấu phần seller operations; nhưng general renderer, tiền và analytics còn khoảng trống. [Technical audit T2–T8](technical-audit.md). Đối thủ đã có personalization và seller tooling, vì vậy không nên định vị “một Etsy khác với nhiều tính năng hơn”. [Feature matrix](feature-matrix.md).

## 1. Định vị A — Custom gifts được tuyển chọn, có người hỗ trợ chốt yêu cầu

**Khách hàng mục tiêu:** một nhóm người mua có dịp tặng quà và nhu cầu cụ thể, cùng một nhóm nhỏ seller có thể đảm bảo chất lượng. Chưa đủ dữ liệu chọn Christmas, pet, family hay nail-professional gifts; chọn bằng phỏng vấn và landing test, không suy từ sản phẩm đã seed.

**Vấn đề giả thuyết:** buyer ngại nhập sai tên/ảnh, không biết hàng có đến kịp hay ai sửa khi sai; seller tốn thời gian trao đổi nhưng mất đơn giữa chat và checkout.

**Đã có:** custom-option validation/variants, offers tạo coupon có scope, buyer/shop messaging và order request. [Purchase panel](../../apps/client/src/components/product/ProductPurchasePanel.tsx#L1039), [offers](../../apps/api/src/modules/marketing/buyer-offers.service.ts#L335), [messaging](../../apps/api/src/modules/messages/messages.service.ts#L706).

**Còn thiếu:** đóng identity/guest-access risks; quy trình duyệt artwork có xác nhận, thời hạn giao có căn cứ, refund/dispute SOP, đối soát thanh toán, supplier QA và measurement đúng. Không dùng demo renderer làm cam kết sản phẩm in ra sẽ giống preview.

**Đối thủ/phương án thay thế:** Etsy custom-request workflow và Amazon Custom; official sources đã kiểm tra 01/10/2026 trong [matrix](feature-matrix.md). Không tuyên bố họ thiếu hỗ trợ khách; thử chứng minh dịch vụ của EziHubb tốt hơn **trong ngách đã chọn**.

**Khả năng bảo vệ:** supplier relationships, template/artwork có quyền sử dụng, độ tin cậy deadline và lịch sử tùy chỉnh phục vụ repeat purchase. Hiện chưa có bằng chứng độc quyền hoặc network effect.

**Metrics:** qualified visit → request → accepted → paid → delivered; first-response time; tỷ lệ sửa artwork; on-time delivery; refund/reprint; contribution/order; repeat purchase theo cohort. Manual requests không tính là paid conversion.

| Thời gian | Công việc | Điều kiện qua mốc |
|---|---|---|
| Ngày 1–30 | Đóng P0, định nghĩa một use case; phỏng vấn buyer/seller; kiểm tra mẫu sản phẩm/quyền asset; ghi SOP proof/delivery/refund; dựng funnel events trung thực | Identity gate qua; chỉ nhận request nếu payments chưa qua money gate; biết rõ ai sản xuất, ai xử lý khiếu nại, thời hạn và chi phí |
| Ngày 31–60 | Pilot có giám sát; chọn một category và destination có khả năng phục vụ; nếu đủ gate mới nhận thanh toán; ghi thời gian hỗ trợ và mọi refund/reprint | Từng order đối soát được; dữ liệu phân biệt test/manual/unpaid; không có chênh lệch tiền không giải thích được; báo cáo pilot có denominator |
| Ngày 61–90 | So sánh cohort/nhóm hỗ trợ; cải thiện điểm rơi lớn nhất; thử thêm seller độc lập theo checklist | Buyer paid/delivered và seller retention có tín hiệu lặp lại; margin sau support/subsidy không bị che; nếu chỉ founder vận hành hiệu quả thì giữ managed model thay vì quảng bá marketplace mở |

## 2. Định vị B — Bộ vận hành personalized/POD dành cho seller nói tiếng Việt

**Khách hàng mục tiêu:** seller đã có demand/kênh bán, đang xử lý nhiều file, biến thể và nhà cung cấp. Đây là hướng seller-tooling/managed operations, không mặc định buyer marketplace là sản phẩm chính.

**Vấn đề giả thuyết:** nhập lại customization, sai mapping SKU/artwork, tra trạng thái bằng tay, khó theo dõi phí và trả lời buyer.

**Đã có:** transactional variants, tách print files khỏi public images, shop conversation, progress steps, API keys, provider adapters và en/vi UI. [Variants](../../apps/api/src/modules/products/products.service.ts#L1764), [public assets](../../apps/api/src/modules/products/products.service.ts#L320), [API keys](../../apps/api/src/modules/partner-api/api-keys.service.ts#L39).

**Còn thiếu:** renderer/print-ready validation tổng quát; integration reliability, stock và finance gates; chứng minh workflow import/order reconciliation đủ tốt; provider accounts và kinh tế hỗ trợ seller. Plus grant là manual entitlement, không phải recurring subscriptions đã thu tiền. [Subscriptions](../../apps/api/src/modules/subscriptions/subscriptions.service.ts#L26).

**Đối thủ:** Shopify + Teeinblue và provider dashboards như Printful. [Teeinblue](https://apps.shopify.com/teeinblue), [Printful](https://www.printful.com/design-your-own-products), kiểm tra 01/10/2026. Chỉ nên thử nếu seller xác nhận có vấn đề các phương án hiện tại giải quyết chưa tốt; không pitch “live preview mới” khi backend EziHubb còn demo-only.

**Khả năng bảo vệ:** SOP tích hợp theo provider, chất lượng chuyển đổi artwork/order, dữ liệu mapping ít lỗi và hỗ trợ chuyên ngành. API wrapper/UI dịch tiếng Việt dễ bị sao chép.

**Metrics:** phút/listing, phút/order, lỗi mapping, first successful fulfillment, exception recovery time, support cost/seller, active seller cohorts và willingness-to-pay thực. Không dùng số đăng ký làm retention.

| Thời gian | Công việc | Điều kiện qua mốc |
|---|---|---|
| Ngày 1–30 | Phỏng vấn seller đang dùng giải pháp thay thế; shadow workflow; chọn **một** provider và một nhóm SKU; fix tenant/credential risks | Có pain quantified bằng thời gian/lỗi và người sẵn sàng thử; không xây thêm integration theo phỏng đoán |
| Ngày 31–60 | Pilot sandbox có artwork QA; implement idempotency, webhook verification, retry/reconciliation; đo cùng task trên baseline hiện tại | Một order từ custom input đến provider rồi trạng thái trả về được chứng minh; lỗi provider không hiện success giả |
| Ngày 61–90 | Pilot trả phí hoặc cam kết thương mại có phạm vi rõ sau money/security gates; đo tiết kiệm ròng sau onboarding/support | Có seller dùng lại và trả tiền thực; nếu phí phục vụ lớn hơn giá trị tiết kiệm thì dừng hoặc thu hẹp managed service |

**Tradeoff:** đổi sang tooling là thay đổi mô hình thương mại đáng kể. Cần quyết định của chủ sản phẩm; báo cáo không tự triển khai pivot.

## 3. Định vị C — Cửa hàng quà tặng theo cộng đồng phân phối từ web nail

**Khách hàng mục tiêu:** nhóm người đọc web nail có liên quan thật đến dịp tặng quà; ví dụ quà cho nail professionals chỉ là ý tưởng test, không phải demand đã xác minh.

**Vấn đề giả thuyết:** người mua muốn sản phẩm phù hợp ngữ cảnh/cộng đồng, không cần duyệt marketplace tổng hợp. Đây có thể là curated storefront đầu tiên, chưa cần nhiều seller.

**Đã có:** storefront, campaigns/products/search, checkout requests, analytics plumbing. Thông tin web nail có traffic là phát biểu của người dùng; audit chưa xem lượng truy cập, geography, cohort hay conversion export.

**Còn thiếu:** xác nhận audience overlap, landing-page proposition, attribution first-party rõ ràng, consent/phân phối phù hợp và unit economics. Cần sửa việc coi mọi external referral là offsite ad trước khi tính seller fees. [MarketingTracker](../../apps/client/src/components/providers/MarketingTracker.tsx#L35), [fee creation](../../apps/api/src/modules/orders/orders.service.ts#L808).

**Đối thủ/phương án thay thế:** buyer tự tìm trên Etsy/Amazon hoặc mua trực tiếp shop họ tin. Năng lực personalization không mới; lợi thế có thể nằm ở sự phù hợp và quan hệ với cộng đồng, hiện chưa chứng minh.

**Khả năng bảo vệ:** kênh phân phối có audience thật, repeat visitation và nội dung độc quyền; banner/SDK tự viết không tạo moat. Chưa cần ad network/SDK kiểu Google để test một banner redirect.

**Metrics:** banner impressions đủ điều kiện, CTR, landing engagement, request/paid conversion, delivered margin mỗi 1.000 impressions, tác động tới nội dung/return visits của web nail. Tính chi phí cơ hội của vị trí quảng cáo dù không trả tiền ads.

| Thời gian | Công việc | Điều kiện qua mốc |
|---|---|---|
| Ngày 1–30 | Xem dữ liệu audience đã giảm PII; phỏng vấn; chọn sản phẩm/landing có liên quan; lập UTM/event dictionary; thiết kế holdout nếu lưu lượng đủ | Có hypothesis cụ thể, merchant disclosure rõ, measurement không thu thập vượt consent và không gán paid-ad fee sai |
| Ngày 31–60 | Chạy một placement nhỏ có nhóm so sánh, giới hạn ngân sách và năng lực nhận đơn; phân tích chất lượng downstream, không chỉ click | Không ảnh hưởng xấu quá mức tới web nguồn theo ngưỡng chủ sở hữu chốt trước; biết request nào thành paid/delivered |
| Ngày 61–90 | Lặp creative/offer tốt nhất, test cohort quay lại và economics; chỉ mở rộng khi hiệu quả tồn tại sau giảm subsidy | Margin và demand có tính lặp lại; nếu CTR tốt nhưng không paid thì điều chỉnh offer/fit, không mặc định tăng impressions |

## 4. Kế hoạch nền tảng chung trước growth

| Thứ tự | Owner đề xuất | Deliverable có thể kiểm chứng |
|---|---|---|
| 1. Identity | Backend/auth + reviewer độc lập | Fix R01/R02/R03/R04; negative HTTP/realtime/tenant tests; session-revocation matrix |
| 2. Money | Backend commerce + người chịu trách nhiệm finance | Pending/available/settled contract, outbox, provider-idempotency, refund/payout reconciliation; test R07–R09 |
| 3. Orders | Backend + operations | Inventory atomicity, multi-store/digital/manual transition tests, fulfillment failure recovery |
| 4. Data | Analytics owner + finance | Data dictionary, không random data trong production reports, attribution provenance, test-data labels |
| 5. Operations | Infra + support lead | Backup/restore evidence, readiness health, ngoài-queue alert, on-call và buyer dispute SOP |
| 6. Pilot | Product/growth + seller operations | Một audience/một offer/một destination; dashboard có mẫu số, cohort và đối soát |

Tên owner là vai trò cần có, không giả định công ty đang có đủ nhân sự. Nếu chỉ một người vận hành, phải giảm scope pilot thay vì tuyên bố đã có toàn bộ chức năng.

## 5. Từ điển chỉ số tối thiểu

- **Request:** order chưa thu tiền; không tính vào paid GMV.
- **Paid GMV:** tổng giá trị hàng của giao dịch captured theo định nghĩa nhất quán; công bố có/không shipping/tax, tách refunded và test. Không dùng cả parent order và store-order để tránh double count.
- **Net platform revenue:** khoản platform thực được hưởng, sau adjustments liên quan; không đồng nhất toàn bộ GMV hay seller payout với doanh thu sàn. Cách ghi nhận kế toán chính thức cần người phụ trách chuyên môn xác nhận.
- **Contribution/order để ra quyết định:** phần platform thu được trừ gateway/variable infra, subsidy, affiliate, refund/reprint/loss và support biến đổi do platform chịu. Với own-store phải tính thêm COGS/fulfillment của store, không trộn economics hai vai trò.
- **Paid conversion:** buyer/session đủ điều kiện dẫn tới capture thành công; báo số mẫu, nguồn, thiết bị, quốc gia và kỳ đo.
- **Liquidity:** tỷ lệ tìm thấy sản phẩm phù hợp, request được seller nhận và thành paid/delivered; seller time-to-first-sale, không chỉ listing count.
- **Retention:** cohort buyer mua lại và seller active lại theo cửa sổ phù hợp mùa vụ. Một mùa Christmas không đủ suy lifetime retention.

Chưa đặt mục tiêu doanh số/CAC hoặc forecast vì thiếu baseline. Trong 30 ngày đầu, chốt ngưỡng go/no-go **trước** pilot theo ngân sách/rủi ro, rồi giữ nguyên để tránh chọn metric có lợi sau khi xem kết quả. Báo cả kết quả không có ý nghĩa thống kê hoặc chưa đủ mẫu.

## 6. Quyết định sau 90 ngày

Chỉ mở rộng một hướng khi có bằng chứng: đúng dữ liệu/tiền, khách chịu trả, giao hàng được, economics giải thích được và workflow có thể lặp lại ngoài thao tác thủ công của founder. Nếu chưa đạt, tiếp tục managed pilot hoặc dừng hypothesis cụ thể; không bù thiếu demand bằng thêm tính năng.
