# Kế hoạch 5 bước tiếp theo — đã duyệt

Ngày: 2026-10-03. Trạng thái: OWNER ĐÃ DUYỆT bằng yêu cầu “chốt”. Đây là kế hoạch được phép triển khai trong repository, không phải bằng chứng hoàn thành hoặc quyền deploy.

Owner đã duyệt các mặc định ở bước 1, TTL giữ kho 15 phút và cách xử lý manual/legacy. Bắt đầu M1–M2 theo thứ tự phụ thuộc bên dưới; không cần hỏi lại cách chia phase. Commit/push/deploy, migration môi trường bên ngoài, sửa lịch sử và kích hoạt tiền thật vẫn cần quyền riêng.

## Phạm vi được đề nghị phê duyệt

Sau khi duyệt: sửa repository, thêm migration additive, cập nhật API/admin/client liên quan, chạy kiểm thử cô lập. Không tự commit/push/deploy, không bật thanh toán thật, không dùng credentials production, không sửa lịch sử tài chính hay gửi email tới khách thật. Nếu chưa có staging/provider sandbox, hoàn thành phần local và ghi rõ phần chưa kiểm chứng, không coi mock là integration thật.

Mục tiêu: một đơn/payout/refund có thể truy ngược tiền và tồn kho; nhiều request hoặc retry vẫn chỉ tạo một hiệu ứng hợp lệ. Phải sửa đồng bộ checkout, hai cổng thanh toán, webhook, cancellation, seller/affiliate payout, finance/stats và worker liên quan, không chỉ vá giao diện hoặc một endpoint.

## 1. Chốt chính sách và bất biến tài chính

Đề xuất mặc định để owner duyệt cùng kế hoạch:

| Vấn đề | Chính sách đề xuất |
|---|---|
| Ghi nhận tiền | Chỉ capture được xác minh mới tạo khoản tiền đã thu. Tạo order, CONFIRMED, hoặc manual order request không phải bằng chứng thanh toán. |
| Seller được rút | Capture hợp lệ, không bị giữ/chờ refund, không đã dành cho payout, sau bù trừ khoản nợ. Theo Option A: không tự thêm kỳ giữ tiền tới ngày giao hàng. Thực thi payout vẫn cần duyệt và bằng chứng chuyển tiền; không tự bật transfer thật. |
| Affiliate đủ điều kiện | Có capture hợp lệ và đạt điều kiện giao hàng + lockDays hiện có; không tự thay mức commission hoặc lockDays. Snapshot chính sách áp dụng cho từng đơn. |
| Refund phí sàn | Đảo phí sàn gắn với phần hàng được hoàn theo tỷ lệ trên allocation gốc. Phí listing không tự hoàn vì không phải phí theo order. Không tính lại bằng biểu phí hiện tại. |
| Refund hoa hồng | Thu hồi đúng phần commission tương ứng với merchandise refunded. Đã payout thì ghi khoản nợ/bù trừ khoản thu tiếp theo, không xóa payout và không tự trích tài khoản ngoài hệ thống. |
| Phí provider, thuế/VAT | Ghi nhận theo chứng từ/quy tắc được xác minh, không giả định provider hoàn phí. Phần chưa xác minh đưa vào chờ đối soát, không đoán thành 0 hoặc tự chuyển gánh nặng sang seller. |
| Refund shipping | Hủy toàn bộ phần đơn của shop trước bàn giao: hoàn phí ship khách thực trả cho phần đó. Refund một phần hoặc sau bàn giao: shipping mặc định 0, super admin có thể duyệt số tiền riêng với lý do/bằng chứng và giới hạn không vượt số đã thu. |
| Ship sàn tài trợ | Khách không trả thì không có tiền ship để hoàn cho khách; seller không nhận khoản ship này. Tách hỗ trợ dự kiến, chi phí thực tế và điều chỉnh/hủy để thống kê không coi báo giá là tiền đã chi. Giữ ngưỡng freeship đang cấu hình, không thay rate. |
| Giới hạn pilot | Không tự chuyển đổi tiền tệ giữa capture, ledger và payout. Mỗi allocation mang currency, từ chối payout trộn currency. |
| Đơn test/lịch sử | Đơn mới có provenance tách biệt lifecycle, test không được dùng live provider và không vào finance thật. Đơn cũ thiếu bằng chứng là LEGACY/UNKNOWN, không tự gắn là test hoặc suy luận đã thu tiền. |
| Quảng cáo | Không tính phí offsite ads chỉ từ referrer. Chỉ tính khi có campaign/click được hệ thống xác minh; thiếu chứng cứ thì không phát sinh phí mới. Không thay rate hay sửa phí cũ. |

Đầu ra: policy version, bảng chuyển trạng thái, công thức và fixtures số tiền cụ thể cho đơn nhiều shop/quantity/discount/subsidy/refund. Đây là điều kiện trước khi viết ledger mới.

## 2. Capture, phân bổ tiền và payout

### Công việc

- Snapshot giá hàng, số lượng, coupon/bundle/affiliate discount, nguồn tài trợ, tiền ship khách trả, hỗ trợ sàn và các tỷ lệ/phí tại checkout. Quote không trở thành số dư rút được.
- Thêm bản ghi nghiệp vụ thanh toán và capture được định danh duy nhất; lưu idempotency key trước khi gọi provider. Stripe, PayPal capture và webhook dùng cùng quy tắc ghi nhận.
- Phân bổ capture về từng shop và order line; tổng tiền phải giải thích được bằng tiền khách trả và khoản sàn tài trợ được ghi rõ, không lấy tổng parent order làm doanh thu của từng shop.
- Trong một transaction: capture + allocation + ledger + sự kiện cần phát. Không gọi provider trong database transaction rồi coi hai hệ thống là atomic.
- Đổi đồng bộ finance overview, statement, balance, payout API và giao diện. Tách tiền chờ điều kiện, tiền khả dụng, tiền đã dành cho payout và khoản nợ; tiền chưa thu không được hiển thị là khả dụng.
- Seller và affiliate payout phải chỉ rõ khoản nào, bao nhiêu được chi. Payout một phần không được đánh dấu mọi commission là PAID. Reject giải phóng đúng phần đã giữ; pay/reject/cancel cạnh tranh chỉ một trạng thái thắng.
- Chỉ cho đánh dấu settlement khi có tham chiếu chuyển tiền có kiểm tra trùng, actor, thời gian và audit trail. Chưa có sandbox transfer thì giữ chưa xác minh, không giả lập thành tiền thật.
- Legacy money hiển thị riêng. Khoản thiếu provenance không được tự trộn vào pool payout mới; lập danh sách cần đối soát để owner xử lý sau.

### Tiêu chí đạt

- Đơn chưa trả/manual request: không tạo available balance.
- Một capture hoặc webhook nhận nhiều lần: một bộ allocation/ledger.
- Hai yêu cầu payout đồng thời không chi vượt phần khả dụng.
- Payout một phần truy được commission/ledger cụ thể, không làm thay đổi phần không liên quan.
- Mọi phép tính dùng Decimal hoặc integer minor units, phân bổ phần lẻ nhất quán; không tích lũy tiền bằng số thực JS.

## 3. Refund, khoản nợ và đối soát

### Công việc

- Refund intent riêng, tham chiếu capture/line/quantity/currency và cùng idempotency key khi retry; từ chối tổng refund vượt số thu còn lại.
- Timeout provider -> NEEDS_RECONCILIATION; tra lại thao tác cũ trước khi gửi lại, không tự tạo refund mới.
- Refund một phần đảo đúng allocation hàng/fee/commission theo bước 1; không ghi đè hoặc xóa settlement ban đầu.
- Chưa payout: giảm đúng available/reserved theo state machine. Đã payout: giữ nguyên chứng từ chi, ghi nợ/compensating entry và bù trừ khoản thu sau.
- Cancel order không đồng nghĩa refund đã thành công. Phân biệt yêu cầu hủy, trạng thái provider, trạng thái tiền và trạng thái fulfillment.
- Dùng một nguồn dữ liệu cho seller balance, admin finance, affiliate balance và stats liên quan; không sửa mỗi màn hình bằng bộ lọc riêng.
- Thêm mục đối soát dành cho super admin: tìm theo order/shop/payment/refund/payout; xem số phải khớp, số thực tế, chênh lệch, trạng thái và lịch sử xử lý. Seller chỉ thấy phần của shop mình.

### Tiêu chí đạt

Refund một trong nhiều shop không đổi shop còn lại; refund một đơn vị trong quantity > 1 đúng phần lẻ; replay không đảo tiền hai lần; refund sau payout vẫn giải thích được toàn bộ số tiền. Không cấp lại tồn kho chỉ vì hoàn tiền: hàng đã giao chỉ restock sau xác nhận nhận lại/kiểm tra hàng.

## 4. Lưu sự kiện bền vững và tồn kho an toàn khi retry

Phần nền móng của bước này phải được thực hiện TRƯỚC khi kích hoạt bước 2–3, không đợi luồng tiền mới chạy rồi mới bổ sung.

### Công việc

- Outbox lưu trong cùng transaction với thay đổi nghiệp vụ. Worker phát lại sự kiện còn chờ; consumer receipt và hiệu ứng tiền/kho ghi trong cùng transaction.
- Unique keys, claim/lease, bounded retries, dead-letter/manual-reconcile và correlation IDs. Payload tối thiểu, không nhét token/PII vào log.
- Tồn kho PostgreSQL là authority: khi settings bật quantity theo variation dùng ProductVariant.quantity; nếu không thì Product.quantity là pool chung. Không trừ cả hai. Null ở cấu hình hữu hạn không được tự coi là vô hạn.
- Snapshot stock target trên reservation để thay đổi settings sau đó không làm consume/release nhầm pool. Sản phẩm unlimited không trừ stock; lưu receipt xử lý để chống replay.
- Online: giữ kho nguyên tử khi bắt đầu thanh toán, TTL đề xuất 15 phút, cấu hình được; capture đổi reservation sang consumed đúng một lần. Hủy/timeout giải phóng đúng phần còn giữ.
- Capture tới muộn sau khi hết giữ kho: không âm kho hoặc tự fulfillment; thử lấy lại stock bằng điều kiện nguyên tử, nếu không đủ thì chặn fulfillment và đưa vào xử lý refund/đối soát.
- Manual hiện tại tiếp tục là yêu cầu đặt hàng, không tự giữ kho vô thời hạn, không tự tạo doanh thu hay fulfillment; kiểm tra/giữ kho lại ở bước chấp nhận xử lý thực tế có audit. Không dùng trạng thái CONFIRMED đang có để suy ra đã thu tiền.
- Fulfillment intent lưu external ID và trạng thái create/push riêng; timeout không tạo lại đơn nhà cung cấp mù quáng. Digital không gửi sang vận chuyển vật lý; parent status phản ánh các shop/line, không đánh đồng đơn hỗn hợp.
- Chỉ kích hoạt producer/consumer mới cho order/operation mang version mới. Không replay hàng loạt đơn đã trả tiền trong lịch sử.

### Tiêu chí đạt

Race mua sản phẩm cuối chỉ một reservation thắng; nhiều line cùng pool được cộng đủ quantity; worker chết trước/sau commit vẫn không trừ kho hai lần; mất Redis không mất event đã commit; provider tạo thành công nhưng local timeout không sinh đơn fulfillment thứ hai.

## 5. Staging, failure drills và quyết định release

### Môi trường

PostgreSQL/Redis/Mongo riêng với dữ liệu synthetic, bucket/mailbox test và Stripe/PayPal sandbox. Provider fulfillment sandbox nếu có; nếu không, ghi rõ UNKNOWN và chưa bật tự động fulfillment. Không lấy credentials production hoặc clone PII production vào fixture. Xác nhận chính xác môi trường trước migration/failure injection.

### Kiểm thử bắt buộc

- Unit/conservation, API integration trên DB thật, concurrent transaction, browser E2E desktop/mobile và RBAC seller A/B/super admin.
- Hai cổng thanh toán: thất bại, timeout, duplicate/out-of-order webhook, capture tới muộn, amount/currency mismatch.
- Nhiều shop, quantity > 1, sale/coupon/bundle/affiliate discount, freeship sàn, refund một phần/toàn phần và sau payout.
- Kill API/worker ở ranh giới provider/DB/queue; phục hồi Redis; replay có giới hạn và kiểm tra chênh lệch.
- Xác minh email/MFA/guest cookie với HTTPS và dịch vụ thật của staging; kiểm tra readiness 503 qua proxy, cảnh báo không phụ thuộc cùng Redis đang lỗi.
- Backup/restore trong database cô lập, đo RPO/RTO thực tế và đối soát sau restore. Không công bố RPO/RTO trước khi đo.
- Build/typecheck/lint và toàn bộ regression qua Nx; không hạ threshold hoặc thay test để bỏ qua lỗi.

### Gate nghiệm thu

Không có chênh lệch tiền không giải thích được trong fixtures; không sai tenant, âm kho, duplicate debit/refund/fulfillment hoặc unhandled recovery case. Các ca chưa test được ghi rõ, không đổi thành PASS. Báo cáo lại pilot readiness theo evidence; sandbox PASS không tự cấp quyền live pilot.

## Thứ tự kỹ thuật và các mốc bàn giao

1. M1: duyệt chính sách bước 1, state machine và acceptance cases.
2. M2: migration additive/provenance + operation intents/outbox/consumer receipts + stock reservation nền móng của bước 4; mặc định chưa activate.
3. M3: nối capture/allocation/balance/payout bước 2; test theo transaction và concurrency.
4. M4: refund/debt/reconciliation bước 3, hoàn tất worker/inventory/fulfillment bước 4; cập nhật API/admin/client liên quan.
5. M5: chạy staging/failure/restore drills bước 5; báo cáo kết quả và trình duyệt release riêng.

Không deploy riêng producer khi reader/consumer mới chưa tương thích. Sau mỗi mốc cập nhật progress và re-audit với kiểm thử thực tế.

## Migration, lịch sử và rollback

- Chỉ thêm bảng/cột/index/constraint; ID mới dùng NanoID 12. Nhóm schema dự kiến: operation/capture/store-line allocation, refund/allocation/debt, payout allocation, outbox/receipt, reservation/consumption và provenance/version. Chốt tên cụ thể sau review schema; không thêm bảng chỉ để tăng độ phức tạp.
- Giữ migration guest-message hiện tại trong kế hoạch rollout nhưng chưa tự apply. Không sửa migration cũ, không drop hoặc backfill tài chính tự động.
- Expand trước, code tương thích/feature flag sau, chỉ activate đơn mới tại cutoff được owner duyệt. Legacy/UNKNOWN vẫn tra cứu được, nhưng không coi thiếu bằng chứng là tiền rút được.
- Rollback bằng dừng tiếp nhận nghiệp vụ mới/dispatch và freeze payout liên quan; giữ intents, allocation, outbox, audit để đối soát. Không xóa các bảng vừa thêm khi đã có capture/transfer, không đơn thuần quay lại cách tính balance cũ cho đơn version mới.
- Việc commit/push/deploy, migrate staging bên ngoài hoặc bật provider chỉ thực hiện khi có môi trường và quyền tương ứng được xác nhận. Deploy production và dùng tiền thật luôn cần lần duyệt riêng.

## Điều kiện bắt đầu

Owner duyệt kế hoạch và các mặc định ở bước 1, TTL giữ kho online 15 phút cùng cách xử lý manual/legacy nêu trên. Nếu cần thay chính sách, sửa kế hoạch trước khi implementation. Khi được duyệt, bắt đầu M1–M2; không hỏi owner cách chia phase.
