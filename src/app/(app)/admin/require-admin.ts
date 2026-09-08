import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";

/** Chặn Server Action nếu người gọi không phải Quản trị hệ thống — trang có
 * thể ẩn nav với vai trò khác, nhưng action ghi dữ liệu vẫn phải tự kiểm tra. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== ROLES.ADMIN) {
    throw new Error("Chỉ Quản trị hệ thống được thực hiện chức năng này.");
  }
  return user;
}
