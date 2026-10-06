# 02 — Feature matrix và đối chiếu cạnh tranh

> Cập nhật 02/10/2026: nội dung bên dưới giữ làm baseline audit 01/10, không phải trạng thái code mới nhất. Đã có các bản sửa local về identity, draft/review access, webhook, provider failure, affiliate concurrency, search và số lượng trong revenue. Xem [re-audit từng finding](../production-hardening/final-re-audit.md), [kết quả kiểm thử](../production-hardening/progress.md) và [pilot readiness](../production-hardening/pilot-readiness.md). Chưa deploy/chạy giao dịch thật; không nâng claim cạnh tranh, traction hoặc doanh thu. Các vấn đề tiền, Google MFA và guest messaging còn chặn paid pilot.

Ngày kiểm tra nguồn: **01/10/2026**. EziHubb: working tree tại baseline ghi trong [technical audit](technical-audit.md), không phải xác nhận production. Đối thủ: tài liệu công khai chính thức, không phải thực nghiệm toàn bộ sản phẩm. **Unverified không có nghĩa là không có tính năng.**

## 1. Nhóm đối thủ phù hợp

| Nền tảng | Vai trò trong phép so sánh | Phạm vi đã xác minh |
|---|---|---|
| Etsy | Marketplace hàng sáng tạo/custom gifts | Personalization/custom requests, phí, buyer protection, quảng cáo/stats — E1–E5 |
| Amazon Handmade + Custom | Marketplace có quy trình đăng ký maker và tùy biến sản phẩm | Handmade application, Custom text/image/options, seller fulfillment — A1–A2 |
| eBay | Marketplace ngang; benchmark vận hành seller và trust | Seller Hub, phí theo loại giao dịch, Money Back Guarantee — B1–B3 |
| Shopify + Teeinblue | Hạ tầng cửa hàng + app, không coi là marketplace giống Etsy | Store platform/pricing, app live preview/production files/POD — S1–S3 |
| MakerPlace by Michaels | Marketplace handmade | Trang đăng ký seller và tài liệu vận hành vẫn truy cập được khi kiểm tra; chưa test giao dịch/onboarding — M1–M3 |
| Printful | Nhà cung cấp POD/công cụ thiết kế và fulfillment, không phải đối thủ marketplace tương đương | Thiết kế text/image và luồng làm hàng/giao hàng — P1 |

Nguồn có URL/ngày ở mục 5. Các tính năng ghi là “có” của đối thủ là **tính năng được tài liệu chính thức công bố**, không bảo đảm mọi quốc gia, gói thuê bao hoặc seller đều được dùng.

## 2. Ma trận năng lực sản phẩm

| Năng lực | EziHubb và bằng chứng | Etsy | Amazon Handmade/Custom | Shopify + app |
|---|---|---|---|---|
| Text/image/options cá nhân hóa | **Implemented** cho input/variant/cart; [T2](technical-audit.md#t2--product--variant--custom-options--cart-implemented-inventory-partial) | Personalization và ảnh qua Messages [E1](https://help.etsy.com/hc/en-us/articles/115015440167-How-to-Request-a-Personalized-or-Custom-Item) | Text, ảnh, options [A2](https://sell.amazon.com/programs/custom) | Teeinblue công bố custom fields/text/photo [S3](https://apps.shopify.com/teeinblue) |
| Preview thiết kế/production file | **Partial**: backend preview chỉ demo template; [source](../../apps/api/src/modules/customization/customization.service.ts#L178) | General live-render/print-file pipeline: **Unverified** trong nguồn đã xem | Có customization; năng lực print-file tương đương EziHubb: **Unverified** | Live preview và production files được công bố [S3](https://apps.shopify.com/teeinblue) |
| Yêu cầu làm hàng/trao đổi riêng | Manual order request + messaging **Implemented**, còn lỗi cancel/guest ownership; [T4](technical-audit.md#t4--checkout--payment--order-events-partial) | Custom request, Messages và private listing [E1](https://help.etsy.com/hc/en-us/articles/115015440167-How-to-Request-a-Personalized-or-Custom-Item) | Đã xác minh configurable listing, chưa đối chiếu private negotiation | Tùy app/workflow; **Unverified** nếu đòi đúng luồng negotiation |
| Seller/store UI, options quản trị | **Implemented**: store context, transactional variants; [source](../../apps/api/src/modules/products/products.service.ts#L1764) | Shop Manager được dùng trong tài liệu Ads/Stats [E4](https://help.etsy.com/hc/en-us/articles/360033701174-How-to-Set-Up-and-Manage-an-Etsy-Ads-Campaign?country=81) | Maker profile/Seller Central [A1](https://sell.amazon.com/programs/handmade) | Store platform [S1](https://www.shopify.com/pricing); app bổ sung personalization |
| Production/fulfillment automation | **Partial**: adapter có code, chưa chứng minh shipment thật; [T6](technical-audit.md#t6--shippingfulfillment-partial) | Đường fulfillment tương đương: **Unverified** ở tập nguồn này | Custom bắt buộc seller-fulfilled, không FBA [A2](https://sell.amazon.com/programs/custom) | Teeinblue công bố gửi đơn tới POD providers [S3](https://apps.shopify.com/teeinblue) |
| Ads và growth analytics | **Partial**: event thật nhưng một số chart synthetic; social chỉ lưu post; [T8](technical-audit.md#t8--marketing-analytics-searchseo-international-hỗn-hợp) | Ads có budget; Stats có báo cáo shop [E4](https://help.etsy.com/hc/en-us/articles/360033701174-How-to-Set-Up-and-Manage-an-Etsy-Ads-Campaign?country=81), [E5](https://help.etsy.com/hc/en-us/articles/115015774268-How-to-Use-Etsy-Stats-for-Your-Shop) | Chưa so sánh sâu bộ ads/analytics riêng Handmade | Có ecosystem app, nhưng không kết luận hiệu quả acquisition từ app listing |

| Năng lực | EziHubb | eBay | MakerPlace | Printful |
|---|---|---|---|---|
| Seller operations/reporting | Có seller console; stats **Partial**, [shop stats](../../apps/api/src/modules/shop-stats/shop-stats.service.ts#L52) | Seller Hub tập trung listings/orders/performance [B2](https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095) | Seller finance transaction/payout reports [M3](https://www.michaels.com/makerplace/seller-support-center/finances/transactions-download) | Thiết kế/POD workflow, không đối chiếu như marketplace ledger [P1](https://www.printful.com/design-your-own-products) |
| Buyer protection/hoàn tiền | Provider refund có, reconciliation thiếu; dispute-case engine **Missing trong source rà soát**; [T5](technical-audit.md#t5--finance--payout--refund--delete-partial) | Money Back Guarantee có điều kiện/exclusions [B3](https://www.ebay.com/help/policies/ebay-money-back-guarantee-policy/ebay-money-back-guarantee-policy?id=4210) | Chi tiết bảo vệ buyer chưa xác minh đủ trong tài liệu mở thành công | Không đồng nhất fulfillment policy với bảo vệ buyer của marketplace |
| Personalization | Input thực; graphical preview **Partial** | General live preview/print file: **Unverified** | General live preview/print file: **Unverified** | Design Maker hỗ trợ artwork/text; cung cấp hàng làm theo yêu cầu [P1](https://www.printful.com/design-your-own-products) |
| Seller payout | **Bookkeeping Implemented**, tự chuyển tiền **Missing trong path rà soát**; [mark paid](../../apps/api/src/modules/stores/stores.service.ts#L700) | Bộ kiểm tra này chưa deep-verify payment settlement policy | Tài liệu mô tả payout theo lịch và điều kiện shipped [M3](https://www.michaels.com/makerplace/seller-support-center/finances/transactions-download) | Không coi payment cho nhà cung cấp là seller payout của marketplace |
| Acquisition/supply | Không có cohort xác minh; nguồn traffic từ web nail chỉ là thông tin người dùng | Không suy thị phần/traffic từ số công cụ seller | Có kênh Michaels trong thông điệp chính thức; không sử dụng claim quy mô chưa kiểm chứng | Fulfillment không tự chứng minh có demand cho shop |

Đối với trust, Etsy cũng có Purchase Protection cho đơn đủ điều kiện [E3](https://help.etsy.com/hc/en-us/articles/7471925990807-Etsy-s-Purchase-Protection-Program). Vì vậy giao diện badge/reviews hoặc nút refund của EziHubb không chứng minh parity về bảo vệ người mua thực tế.

## 3. Chi phí: không suy ra “EziHubb rẻ hơn”

| Hệ thống | Thông tin có thể xác minh | Giới hạn so sánh |
|---|---|---|
| EziHubb | Schema default transaction 6,5%, processing 5% + $0,25, listing $0,20; còn các trường regulatory/VAT/offsite. [PlatformSettings](../../prisma/schema.prisma#L922) | Đây là **default trong source**, không phải biểu phí commercial hiện hành. Phí còn phụ thuộc DB config, base tính, miễn/giảm và đường checkout; chưa có đối soát thực |
| Etsy | Listing $0,20; transaction 6,5%; processing riêng theo quốc gia. [E2](https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics) | Không cộng thành một “all-in” duy nhất; còn điều kiện/các phí khác |
| Amazon Handmade | Trang US công bố referral 15% hoặc $0,30, lấy mức lớn hơn; Professional monthly fee được miễn theo điều kiện Handmade, có lưu ý chi phí tháng đầu. [A1](https://sell.amazon.com/programs/handmade) | Không khái quát tất cả region hoặc tất cả loại hàng |
| eBay | Insertion/final-value fees phụ thuộc category/Store; fee base gồm các thành phần giao dịch được mô tả. [B1](https://www.ebay.com/sellercenter/selling/start-selling-on-ebay/seller-fees) | Không tự chọn một mức % làm chuẩn cho mọi seller |
| Shopify + app | Phí plan, processing và third-party transaction fee tùy trường hợp; app có chi phí riêng. [S1](https://www.shopify.com/pricing), [S2](https://help.shopify.com/en/manual/your-account/manage-billing/billing-charges/types-of-charges/third-party-charges/third-party-transaction-fees) | Không tương đương take rate marketplace có sẵn demand |
| MakerPlace | Standard 4%, Premium 2% transaction fee; processing 3% + $0,20 với base có taxes/shipping theo tài liệu. [M2](https://www.michaels.com/makerplace/seller-support-center/setting-up-your-store/seller-plan-options), [M3](https://www.michaels.com/makerplace/seller-support-center/finances/transactions-download) | Premium có điều kiện chi tiêu tại Michaels; không coi 2% là tổng chi phí |
| Printful | Nguồn kiểm tra xác nhận quy trình thiết kế/sản xuất/giao hàng, không chốt một biểu phí chung | Cần quote theo SKU, destination và shipping; **Unverified** trong audit này |

Muốn so sánh giá hợp lệ phải chọn cùng SKU, quốc gia seller/buyer, AOV, số quantity, shipping, ads attribution, refund rate và chi phí acquisition. Chưa có bộ dữ liệu đó. Phí nội bộ chưa bao gồm đầy đủ các dịch vụ mà đối thủ thực hiện thì “thấp hơn” cũng không chứng minh lợi thế.

## 4. Những kết luận được và không được rút ra

1. Personalization, shop dashboard và marketing tools là năng lực cạnh tranh cần có, **không tự động là moat**. Đã có đối chứng chính thức E1/A2/S3/B2.
2. General preview + production automation là khoảng cách đáng chú ý với app chuyên dụng S3, không phải điểm EziHubb đã vượt họ.
3. Shopify ecosystem là phương án thay thế “lắp ghép công cụ”; lợi ích của EziHubb có thể là quy trình được chọn sẵn cho một ngách. Chưa đo onboarding time/TCO nên đó là giả thuyết.
4. MakerPlace có dấu hiệu hoạt động công khai và seller docs truy cập được vào ngày kiểm tra; không suy doanh số, chất lượng hỗ trợ hoặc thành công giao dịch từ việc website còn mở.
5. “Không tìm thấy trong nguồn đã xem” phải giữ là Unverified, không đổi thành “đối thủ không có”. Không có benchmark hiệu năng, conversion hoặc giá trị khách hàng trực tiếp giữa EziHubb và các đối thủ.

## 5. Sổ nguồn chính thức

Tất cả nguồn sau được kiểm tra **01/10/2026**. Tài liệu nền tảng là bằng chứng cho khả năng/chính sách họ công bố, không phải bằng chứng thực nghiệm hiệu quả của EziHubb. Không dùng review người dùng hoặc marketing testimonial để ước tính uplift.

| ID | URL và nội dung dùng |
|---|---|
| E1 | [Etsy personalization/custom requests](https://help.etsy.com/hc/en-us/articles/115015440167-How-to-Request-a-Personalized-or-Custom-Item) — input, Messages, custom listing |
| E2 | [Etsy Fee Basics](https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics) — listing/transaction/processing |
| E3 | [Etsy Purchase Protection](https://help.etsy.com/hc/en-us/articles/7471925990807-Etsy-s-Purchase-Protection-Program) — cơ chế bảo vệ có điều kiện |
| E4 | [Etsy Ads setup](https://help.etsy.com/hc/en-us/articles/360033701174-How-to-Set-Up-and-Manage-an-Etsy-Ads-Campaign?country=81) — budget/listings/campaign |
| E5 | [Etsy Stats](https://help.etsy.com/hc/en-us/articles/115015774268-How-to-Use-Etsy-Stats-for-Your-Shop) — shop statistics |
| A1 | [Amazon Handmade](https://sell.amazon.com/programs/handmade) — chương trình maker, phí theo trang US |
| A2 | [Amazon Custom](https://sell.amazon.com/programs/custom) — types of customization, seller fulfillment |
| B1 | [eBay Seller fees](https://www.ebay.com/sellercenter/selling/start-selling-on-ebay/seller-fees) — cấu trúc phí |
| B2 | [eBay Seller Hub](https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4095) — công cụ vận hành/reporting |
| B3 | [eBay Money Back Guarantee policy](https://www.ebay.com/help/policies/ebay-money-back-guarantee-policy/ebay-money-back-guarantee-policy?id=4210) — policy, không phải cam kết vô điều kiện |
| S1 | [Shopify Pricing](https://www.shopify.com/pricing) — store platform/plan structure |
| S2 | [Shopify third-party transaction fees](https://help.shopify.com/en/manual/your-account/manage-billing/billing-charges/types-of-charges/third-party-charges/third-party-transaction-fees) — trường hợp áp dụng phí |
| S3 | [Teeinblue trên Shopify App Store](https://apps.shopify.com/teeinblue) — live preview, production files, POD integrations; nội dung capability do app developer công bố |
| M1 | [MakerPlace Become a Seller](https://www.michaels.com/makerplace/sell) — hiện diện public/onboarding |
| M2 | [MakerPlace Seller Plan Options](https://www.michaels.com/makerplace/seller-support-center/setting-up-your-store/seller-plan-options) — Standard/Premium và điều kiện |
| M3 | [MakerPlace financial transactions](https://www.michaels.com/makerplace/seller-support-center/finances/transactions-download) — fee base, reporting, payout schedule |
| P1 | [Printful custom products](https://www.printful.com/design-your-own-products) — Design Maker và POD workflow |

Trang MakerPlace seller agreement xuất hiện trong search nhưng direct open gặp lỗi; các kết luận về phí ở đây dùng M2/M3 mở/tra cứu được, không dựa vào việc đã đọc đầy đủ agreement. Nội dung có thể thay đổi; cần kiểm tra lại trước quyết định thương mại.
