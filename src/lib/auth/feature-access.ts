import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/interactions/constants";
import { PERMISSION_FEATURES, type PermissionFeatureKey } from "@/app/(app)/admin/permissions/permission-types";

export type FeatureAccessActor = { email: string; role: string };

function grantsAccess(row: { canCreate: boolean; canEdit: boolean; canDelete: boolean; canReport: boolean } | null | undefined): boolean {
  return !!row && (row.canCreate || row.canEdit || row.canDelete || row.canReport);
}

// Admin luôn có đủ quyền mặc định (không có dòng riêng trong feature_permissions
// — xem PERMISSION_ROLES ở permission-types.ts). Vai trò khác được cấp quyền
// qua 2 nguồn CỘNG DỒN (OR), không nguồn nào ghi đè nguồn kia:
// - feature_permissions: theo VAI TRÒ (tab "Theo vai trò" ở /admin/permissions).
// - user_feature_permissions: theo TỪNG NGƯỜI DÙNG cụ thể (tab "Theo người
//   dùng") — dùng khi chỉ cần mở 1 trang cho đúng 1 Sale/Marketing/Leader cụ
//   thể mà không muốn mở cho cả vai trò đó.
export async function canAccessFeature(actor: FeatureAccessActor, feature: PermissionFeatureKey): Promise<boolean> {
  if (actor.role === ROLES.ADMIN) return true;

  const [roleRow, userRow] = await Promise.all([
    prisma.featurePermission.findUnique({ where: { feature_role: { feature, role: actor.role } } }),
    prisma.userFeaturePermission.findUnique({ where: { userEmail_feature: { userEmail: actor.email, feature } } }),
  ]);
  return grantsAccess(roleRow) || grantsAccess(userRow);
}

// Gọi ở đầu mỗi Server Component page tương ứng 1 mục nav — chỉ chặn ở mức
// router (vào được trang hay không), chưa phân quyền sâu từng hành động
// trong trang vì tính năng bên trong chưa phát triển xong.
export async function requireFeatureAccess(actor: FeatureAccessActor, feature: PermissionFeatureKey) {
  if (!(await canAccessFeature(actor, feature))) {
    redirect("/access-denied");
  }
}

// Danh sách href (mục nav) mà actor hiện tại được vào — dùng để ẩn/hiện mục
// nav ở sidebar (getNavGroupsForRole ở lib/nav.ts), tách biệt khỏi
// requireFeatureAccess() (chặn khi vào thẳng URL). Href nào không nằm trong
// PERMISSION_FEATURES (Dashboard tổng, nhóm Quản trị, Nhật ký...) không bị
// chặn — luôn hiện với mọi vai trò đã đăng nhập. Hợp nhất role-level +
// user-level giống canAccessFeature() ở trên.
export async function getAccessibleHrefsForUser(actor: FeatureAccessActor): Promise<string[]> {
  if (actor.role === ROLES.ADMIN) return PERMISSION_FEATURES.map((f) => f.href);

  const [roleRows, userRows] = await Promise.all([
    prisma.featurePermission.findMany({ where: { role: actor.role } }),
    prisma.userFeaturePermission.findMany({ where: { userEmail: actor.email } }),
  ]);
  const allowedKeys = new Set<string>();
  for (const r of roleRows) if (grantsAccess(r)) allowedKeys.add(r.feature);
  for (const r of userRows) if (grantsAccess(r)) allowedKeys.add(r.feature);

  return PERMISSION_FEATURES.filter((f) => allowedKeys.has(f.key)).map((f) => f.href);
}
