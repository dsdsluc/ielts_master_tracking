-- Đổi tên vai trò cho rõ ràng hơn, gộp "BGĐ" + "Quản trị hệ thống" thành 1
-- vai trò "Admin" duy nhất — chỉ còn 4 vai trò: Saler, Leader, Marketing, Admin.
-- Không đổi schema (role vẫn là cột String tự do), chỉ cập nhật dữ liệu.
UPDATE "users" SET "role" = 'Saler' WHERE "role" = 'Sale/Admin';
UPDATE "users" SET "role" = 'Admin' WHERE "role" IN ('BGĐ', 'Quản trị hệ thống');
