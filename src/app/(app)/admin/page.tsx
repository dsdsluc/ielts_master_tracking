import { redirect } from "next/navigation";

// "/admin" không còn là trang riêng — đã gộp Giám sát + Rà soát SLA + Người
// dùng + Cấu hình hệ thống vào "/admin/monitoring" (xem section-quick-nav.tsx).
// Giữ redirect ở đây để link/bookmark cũ tới "/admin" vẫn vào đúng chỗ.
export default function AdminRootRedirect() {
  redirect("/admin/monitoring");
}
