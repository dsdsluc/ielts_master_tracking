import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";

// Hệ thống chưa phân quyền (đang xây lại từ đầu) — không còn chặn theo vai
// trò. Giữ lại hàm này (thay vì xoá + sửa mọi nơi gọi) để việc gắn quyền admin
// thật quay lại sau này chỉ cần sửa đúng 1 chỗ.
export async function requireAdmin() {
  return getCurrentUser();
}
