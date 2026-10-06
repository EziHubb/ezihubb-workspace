# 06 — Investor-ready summary

> Cập nhật 02/10/2026: nội dung bên dưới giữ làm baseline audit 01/10, không phải trạng thái code mới nhất. Đã có các bản sửa local về identity, draft/review access, webhook, provider failure, affiliate concurrency, search và số lượng trong revenue. Xem [re-audit từng finding](../production-hardening/final-re-audit.md), [kết quả kiểm thử](../production-hardening/progress.md) và [pilot readiness](../production-hardening/pilot-readiness.md). Chưa deploy/chạy giao dịch thật; không nâng claim cạnh tranh, traction hoặc doanh thu. Các vấn đề tiền, Google MFA và guest messaging còn chặn paid pilot.

Ngày: **01/10/2026**. Bản tóm tắt diligence nội bộ, không phải pitch quảng cáo hay chứng nhận production. Baseline: commit `57d8628768374c6be577a30e884bcd1a134cf833` cộng working-tree changes chưa commit. Không kiểm tra database/gateway live hoặc số liệu kinh doanh.

## Luận điểm ngắn có thể sử dụng

> EziHubb đã xây dựng nền tảng marketplace với buyer storefront, seller/platform console, sản phẩm tùy biến, order/store-order, messaging và các cấu phần vận hành thương mại. Hướng cần kiểm chứng là một trải nghiệm custom gifts theo ngách, kết hợp thu yêu cầu, thương lượng và hỗ trợ thực hiện đơn. Năng lực giao dịch và bảo mật còn các release blockers; hiệu quả thương mại và lợi thế cạnh tranh chưa được chứng minh bằng cohort thực tế.

## 1. Tài sản kỹ thuật nhà đầu tư có thể kiểm chứng

| Tài sản | Bằng chứng | Giới hạn |
|---|---|---|
| Nx workspace với 3 ứng dụng và shared packages | Project inventory; [AppModule](../../apps/api/src/app/app.module.ts), [package.json](../../package.json) | Không suy năng suất hoặc giá trị doanh nghiệp từ số project/module |
| Commerce domain có thực | ProductVariant, Order/StoreOrder, ledger, promotions; [schema](../../prisma/schema.prisma#L687), [variant transaction](../../apps/api/src/modules/products/products.service.ts#L1764) | Inventory và money consistency chưa hoàn chỉnh |
| Custom-order workflow | Required inputs, buyer-specific offers, conversation có idempotent message IDs; [offers](../../apps/api/src/modules/marketing/buyer-offers.service.ts#L335), [messages](../../apps/api/src/modules/messages/messages.service.ts#L706) | General graphical preview chỉ demo template; guest-access risks phải sửa |
| Financial retention và shipping support | Ledger reversals, archive thay delete financial records, threshold/subsidy reporting; [retention](../../apps/api/src/modules/orders/orders.service.ts#L1683), [shipping report](../../apps/api/src/modules/stores/stores.service.ts#L831) | Không phải full accounting, bank settlement hoặc chi phí carrier đã đối soát |
| Adapter/services nền tảng | Stripe/PayPal, fulfillment, image jobs, email/push, translations có source paths; [technical trace](technical-audit.md#3-trace-các-luồng-quan-trọng) | API code không chứng minh live keys, merchant approval hay provider reliability |
| Engineering checks | Typecheck API/client/admin PASS; 5 unit suites **38/38 PASS** ngày 01/10/2026, không cache | Chỉ focused tests; không test live payment, browser E2E, load hoặc toàn bộ security |

Sở hữu repository không tự chứng minh IP assignment/license của mọi asset, thư viện, contractor contribution hoặc quyền dùng template. Đó là hồ sơ diligence riêng cần bổ sung.

## 2. Ba loại readiness phải trình bày riêng

| Loại | Kết luận hiện tại |
|---|---|
| **Technical readiness** | Có implementation đáng kể để chuẩn bị demo/pilot có kiểm soát, nhưng các lỗi identity/payment/metrics ngăn khẳng định production-ready toàn hệ thống. Cần đóng release gates |
| **Commercial readiness** | Chưa xác minh live collection, seller disbursement, refund reconciliation, seller QA, buyer-protection SOP, logistics SLA và nghĩa vụ theo thị trường |
| **Market traction** | **Unknown**: chưa có traffic/paid GMV/retention/CAC hoặc cohort seller độc lập được kiểm chứng. Traffic web nail là thông tin founder cung cấp, chưa phải dữ liệu của EziHubb |

Không suy valuation, TAM, xác suất gọi vốn hoặc expected return từ số lượng source files và feature screenshots.

## 3. Những phần có thể chuẩn bị để demo

Đây là **kịch bản đề xuất từ code**, không phải biên bản demo đã chạy thành công đầu-cuối. Chỉ dùng dữ liệu giả trong môi trường cô lập, không đưa PII/keys production vào buổi demo.

1. Seller nhập sản phẩm/variants/custom inputs → buyer chọn options → cart áp sale. Giải thích phạm vi test pricing đã chạy; không hứa tồn kho concurrency đúng trước khi sửa.
2. Buyer gửi request → seller trao đổi/offer → coupon đúng buyer/listing. Gắn rõ “request, chưa thu tiền” khi online payments tắt.
3. Platform điều chỉnh threshold freeship → xem ví dụ subsidy theo order; phân biệt chi phí hỗ trợ với doanh thu seller.
4. Session history/revocation chỉ demo sau khi đóng MFA/guest-linking blockers. Không trình bày auth hiện tại là security differentiator.

**Chưa nên demo như capability hoàn chỉnh:** customizer tùy ý ra print-ready file, social auto-publishing, tự động chuyển payout, recurring Plus billing, chargeback resolution hoặc analytics historical data hiện đang synthetic. Các giới hạn có source evidence trong [technical audit](technical-audit.md).

## 4. Claim hygiene cho pitch deck

| Có thể nói với qualifier | Chưa được nói như sự thật |
|---|---|
| “Đã triển khai storefront và seller operations trong source; đang harden cho pilot” | “Marketplace production-ready, đủ an toàn và sẵn sàng scale” |
| “Có Stripe/PayPal adapter và refund API; live end-to-end chưa kiểm chứng” | “Thanh toán và payout toàn cầu đã hoạt động đầy đủ” |
| “Có custom inputs và demo rendering pipeline” | “AI personalization/print-ready engine hoàn chỉnh hoặc vượt đối thủ” |
| “Có ledger retention/reversal và shipping-support report” | “Sổ kế toán chính xác tuyệt đối, mọi doanh thu đã được đối soát” |
| “38 focused unit tests và 3 app typechecks PASS cục bộ” | “Mọi flow đã được kiểm thử hoặc không còn lỗi bảo mật” |
| “Có giả thuyết distribution từ web nail để thử nghiệm” | “Có CAC thấp, demand bảo đảm hoặc network effect” |
| “Các workflows là cơ sở thử một custom-gifts niche” | “Không đối thủ nào có personalization, chat, ads hoặc seller dashboard” |

Đối chiếu nguồn chính thức ngày 01/10/2026 cho thấy personalization và seller tooling không phải năng lực riêng của EziHubb; xem [feature matrix](feature-matrix.md). **Chưa có mục A — Verified Competitive Advantage.** Hai cách đóng gói workflow thuộc nhóm B và các giả thuyết nhóm C được giải thích trong [competitive advantages](competitive-advantages.md), không tự biến thành moat.

## 5. Giới hạn quan trọng phải chủ động công bố

- Token TOTP challenge chưa được tách đúng khỏi access authorization; đăng ký email chưa verify có thể claim guest data trong điều kiện cụ thể. Đây là static findings, không phải xác nhận production đã bị xâm nhập. [R01/R02](gaps-and-risks.md#2-rủi-ro-identity-và-quyền-riêng-tư).
- Khi bật online payments, pending sale có thể đi vào available ledger; commit-payment/publish-event không nguyên tử; refund và seller ledger chưa reconcile. [R07–R09](gaps-and-risks.md#3-tiền-tồn-kho-và-thực-hiện-đơn).
- Product Performance có số liệu mô phỏng; một số multi-store totals sai. Không dùng các chart này làm traction slide. [Performance](../../apps/api/src/modules/products/products.service.ts#L1393), [shop totals](../../apps/api/src/modules/shop-stats/shop-stats.service.ts#L52).
- Provider configuration, backup/restore, SLO/load, external policies và business economics chưa có hồ sơ kiểm chứng.

Các phát hiện nêu rõ để quản trị rủi ro, không phải tuyên bố sản phẩm không có giá trị. Tài sản engineering và commercial proof là hai loại bằng chứng khác nhau.

## 6. Câu hỏi khó cần chuẩn bị

1. Ngách khách hàng nào thực sự trả tiền, và họ chọn EziHubb thay vì shop Etsy hoặc cửa hàng Shopify vì điều gì?
2. Bao nhiêu đơn captured, delivered, refunded? Có bao nhiêu order test/manual/unpaid trong dashboard?
3. Ngoài shop của founder, có bao nhiêu seller độc lập đang bán và quay lại? Time-to-first-sale là bao lâu?
4. Contribution margin sau gateway, support, reprint, affiliate và shipping subsidy là bao nhiêu? Own-store và marketplace economics được tách thế nào?
5. Ai chịu trách nhiệm nếu nghệ phẩm sai, hàng trễ hoặc seller biến mất? Reserve và refund operations lấy tiền từ đâu?
6. Tiền buyer thu được khớp payment/ledger/payout/bank ra sao? Ai approve và reconcile manual payout?
7. R01/R02 đã được fix và independently reviewed chưa? Có regression tests và evidence không?
8. Ảnh, font, mẫu thiết kế có quyền dùng thương mại không? Seller verification/IP takedown xử lý thế nào?
9. Nếu mất Redis, provider timeout hoặc Mongo/PG lệch dữ liệu, hệ thống khôi phục order thế nào? Restore drill gần nhất ở đâu?
10. Tại sao một seller không dùng Shopify + app/POD dashboard? Tiết kiệm đo được có vượt switching/onboarding/support cost không?
11. Web nail mang buyer phù hợp hay chỉ mang click? Mức chuyển đổi và hiệu ứng lên trải nghiệm website nguồn có được đo với nhóm so sánh không?
12. Điều gì tạo defensibility ngoài code và subsidy: supply quality, distribution, dữ liệu, quyền IP hay switching cost? Bằng chứng nào chứng minh?

## 7. Evidence room nên bổ sung

**Trước pitch có tuyên bố thương mại:** sanitized deployment/version inventory; proof đã đóng identity/money gates; transaction reconciliation mẫu; metric dictionary và cohort có denominator; founder-vs-independent-seller split; đơn hàng/giao hàng/refund thật; nguồn quyền sở hữu source/assets; thị trường/pháp nhân và SOP người mua.

**Sau khi có nguồn lực để pilot có kiểm soát:** load/restore exercises, independent security review, supplier quality records, experiment logs và contribution margin theo cohort; chứng minh seller/buyer retention qua thời gian đủ dài với ngành có mùa vụ.

Không đưa secrets, raw PII, số thẻ hoặc token vào data room. Chỉ cung cấp aggregate/sanitized evidence theo quyền truy cập phù hợp.

## Hướng dùng nguồn lực hợp lý

Đầu tư ưu tiên vào hardening giao dịch/identity, một SOP fulfillment/refund rõ ràng và một pilot demand theo ngách; chưa có căn cứ để đầu tư vào marketplace đa ngành hoặc ad SDK phức tạp. Lộ trình và go/no-go gates trong [strategic roadmap](strategic-roadmap.md).
