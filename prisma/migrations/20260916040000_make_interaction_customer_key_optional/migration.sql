-- Liên hệ chưa Đủ tiêu chuẩn (chưa có SĐT) giờ KHÔNG còn tạo dòng Customer
-- tương ứng nữa (xem createInteraction() trong mutations.ts) — customer_key
-- vì vậy phải cho phép NULL. FK tới customers vẫn còn nguyên, chỉ áp dụng khi
-- customer_key có giá trị (NULL luôn được FK bỏ qua).
ALTER TABLE "interactions" ALTER COLUMN "customer_key" DROP NOT NULL;
