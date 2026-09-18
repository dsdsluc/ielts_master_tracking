-- Đổi tên trạng thái "Tiếp nhận" -> "Có nhu cầu" (STATUS.PROCESSING trong
-- lib/interactions/constants.ts) — tên cũ gây hiểu lầm là 1 bước TỰ ĐỘNG
-- ngay khi có link cuộc hội thoại; định nghĩa đúng là Sale ĐÃ chủ động nhắn
-- tin với khách nhưng CHƯA xin được SĐT. "statuses"."name" là khoá chính, mọi
-- FK tham chiếu tới nó (interactions.status_name, customers.current_status_name,
-- status_allowed_roles.status_name) đều đã khai báo ON UPDATE CASCADE ngay từ
-- migration khởi tạo -> chỉ cần UPDATE đúng 1 dòng ở bảng gốc, Postgres tự lan
-- toả sang mọi bảng tham chiếu.
UPDATE "statuses" SET "name" = 'Có nhu cầu' WHERE "name" = 'Tiếp nhận';
