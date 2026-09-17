import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { prisma } from "@/lib/prisma";
import { PermissionsManager } from "@/app/(app)/admin/permissions/permissions-manager";
import {
  PERMISSION_FEATURES,
  PERMISSION_ROLES,
  type PermissionFeatureKey,
  type PermissionRow,
} from "@/app/(app)/admin/permissions/permission-types";

export default async function AdminPermissionsPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user.role, "adminPermissions");

  const rows = await prisma.featurePermission.findMany();
  const byFeatureAndRole = new Map(rows.map((r) => [`${r.feature}:${r.role}`, r]));

  // Không seed sẵn — fallback về false cho tính năng/vai trò chưa có dòng nào
  // trong feature_permissions, dòng thật sự chỉ được tạo khi Admin bấm "Cập
  // nhật quyền" lần đầu (xem upsert() ở actions.ts).
  const initialData = Object.fromEntries(
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

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Phân quyền"
        description="Tick bất kỳ cột nào (Thêm/Sửa/Xóa/Báo cáo) để cấp quyền truy cập trang tương ứng cho vai trò đó. Admin luôn có đủ quyền, không cần cấu hình."
      />

      <PermissionsManager initialData={initialData} />
    </>
  );
}
