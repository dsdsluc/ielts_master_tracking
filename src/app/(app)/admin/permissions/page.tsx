import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { prisma } from "@/lib/prisma";
import { PermissionsTabs } from "@/app/(app)/admin/permissions/permissions-tabs";
import {
  PERMISSION_FEATURES,
  PERMISSION_ROLES,
  EMPTY_PERMISSION_CELL,
  type PermissionFeatureKey,
  type PermissionRow,
} from "@/app/(app)/admin/permissions/permission-types";
import type { UserGrants } from "@/app/(app)/admin/permissions/user-permissions-manager";

export default async function AdminPermissionsPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "adminPermissions");

  const [roleRows, users, userFeatureRows] = await Promise.all([
    prisma.featurePermission.findMany(),
    // Admin luôn có đủ quyền, không cần xuất hiện ở bộ chọn cấp quyền riêng.
    prisma.user.findMany({
      where: { role: { in: [...PERMISSION_ROLES] }, active: true },
      select: { email: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.userFeaturePermission.findMany(),
  ]);

  const byFeatureAndRole = new Map(roleRows.map((r) => [`${r.feature}:${r.role}`, r]));

  // Không seed sẵn — fallback về false cho tính năng/vai trò chưa có dòng nào
  // trong feature_permissions, dòng thật sự chỉ được tạo khi Admin bấm "Cập
  // nhật quyền" lần đầu (xem upsert() ở actions.ts).
  const roleData = Object.fromEntries(
    PERMISSION_FEATURES.map((feature) => [
      feature.key,
      PERMISSION_ROLES.map((role): PermissionRow => {
        const row = byFeatureAndRole.get(`${feature.key}:${role}`);
        return {
          role,
          canCreate: row?.canCreate ?? false,
          canEdit: row?.canEdit ?? false,
          canDelete: row?.canDelete ?? false,
          canReport: row?.canReport ?? false,
        };
      }),
    ])
  ) as Record<PermissionFeatureKey, PermissionRow[]>;

  // Tab "Theo người dùng": mỗi feature CHƯA có dòng riêng cho người đó thì
  // HIỂN THỊ SẴN đúng quyền mặc định theo vai trò của họ (không để trống) —
  // tránh cảm giác "xung đột"/thiếu quyền giả tạo khi vai trò đã cấp sẵn.
  // Bấm Lưu sẽ ghi lại TOÀN BỘ lưới hiện tại thành dòng riêng của người đó
  // (kể cả những ô đang chỉ là kế thừa từ vai trò) — từ đó về sau feature nào
  // đã có dòng riêng thì dòng đó LÀ NGUỒN DUY NHẤT quyết định, không còn phụ
  // thuộc vai trò nữa (xem canAccessFeature() ở lib/auth/feature-access.ts).
  const byUserAndFeature = new Map(userFeatureRows.map((r) => [`${r.userEmail}:${r.feature}`, r]));
  const userData: Record<string, UserGrants> = Object.fromEntries(
    users.map((u) => [
      u.email,
      Object.fromEntries(
        PERMISSION_FEATURES.map((feature) => {
          const userRow = byUserAndFeature.get(`${u.email}:${feature.key}`);
          if (userRow) {
            return [feature.key, { canCreate: userRow.canCreate, canEdit: userRow.canEdit, canDelete: userRow.canDelete, canReport: userRow.canReport }];
          }
          const roleRow = byFeatureAndRole.get(`${feature.key}:${u.role}`);
          return [
            feature.key,
            roleRow
              ? { canCreate: roleRow.canCreate, canEdit: roleRow.canEdit, canDelete: roleRow.canDelete, canReport: roleRow.canReport }
              : EMPTY_PERMISSION_CELL,
          ];
        })
      ) as UserGrants,
    ])
  );

  // Feature nào đã có dòng riêng (bất kể true/false) — dùng để UI phân biệt
  // "đang theo mặc định vai trò" với "đã tuỳ chỉnh riêng cho người này".
  const overriddenFeatures: Record<string, PermissionFeatureKey[]> = Object.fromEntries(
    users.map((u) => [u.email, userFeatureRows.filter((r) => r.userEmail === u.email).map((r) => r.feature as PermissionFeatureKey)])
  );

  return <PermissionsTabs roleData={roleData} users={users} userData={userData} overriddenFeatures={overriddenFeatures} />;
}
