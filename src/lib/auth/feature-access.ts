import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/interactions/constants";
import { PERMISSION_FEATURES, type PermissionFeatureKey } from "@/app/(app)/admin/permissions/permission-types";

// Admin luôn có đủ quyền mặc định (không có dòng riêng trong feature_permissions
// — xem PERMISSION_ROLES ở permission-types.ts), các vai trò còn lại cần tick
// ít nhất 1 trong 4 cột Thêm/Sửa/Xóa/Báo cáo mới vào được route của feature đó.
export async function canAccessFeature(role: string, feature: PermissionFeatureKey): Promise<boolean> {
  if (role === ROLES.ADMIN) return true;

  const row = await prisma.featurePermission.findUnique({
    where: { feature_role: { feature, role } },
  });
  return !!row && (row.canCreate || row.canEdit || row.canDelete || row.canReport);
}

// Gọi ở đầu mỗi Server Component page tương ứng 1 mục nav — chỉ chặn ở mức
// router (vào được trang hay không), chưa phân quyền sâu từng hành động
// trong trang vì tính năng bên trong chưa phát triển xong.
export async function requireFeatureAccess(role: string, feature: PermissionFeatureKey) {
  if (!(await canAccessFeature(role, feature))) {
    redirect("/access-denied");
  }
}

// Danh sách href (mục nav) mà role hiện tại được vào — dùng để ẩn/hiện mục
// nav ở sidebar (getNavGroupsForRole ở lib/nav.ts), tách biệt khỏi
// requireFeatureAccess() (chặn khi vào thẳng URL). Href nào không nằm trong
// PERMISSION_FEATURES (Dashboard tổng, nhóm Quản trị, Nhật ký...) không bị
// chặn — luôn hiện với mọi vai trò đã đăng nhập.
export async function getAccessibleHrefsForRole(role: string): Promise<string[]> {
  if (role === ROLES.ADMIN) return PERMISSION_FEATURES.map((f) => f.href);

  const rows = await prisma.featurePermission.findMany({ where: { role } });
  const allowedKeys = new Set(
    rows.filter((r) => r.canCreate || r.canEdit || r.canDelete || r.canReport).map((r) => r.feature)
  );
  return PERMISSION_FEATURES.filter((f) => allowedKeys.has(f.key)).map((f) => f.href);
}
