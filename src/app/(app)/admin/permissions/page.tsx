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

  const byUserAndFeature = new Map(userFeatureRows.map((r) => [`${r.userEmail}:${r.feature}`, r]));
  const userData: Record<string, UserGrants> = Object.fromEntries(
    users.map((u) => [
      u.email,
      Object.fromEntries(
        PERMISSION_FEATURES.map((feature) => {
          const row = byUserAndFeature.get(`${u.email}:${feature.key}`);
          return [
            feature.key,
            row ? { canCreate: row.canCreate, canEdit: row.canEdit, canDelete: row.canDelete, canReport: row.canReport } : EMPTY_PERMISSION_CELL,
          ];
        })
      ) as UserGrants,
    ])
  );

  return <PermissionsTabs roleData={roleData} users={users} userData={userData} />;
}
