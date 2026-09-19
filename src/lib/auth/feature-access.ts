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
// qua 2 lớp, lớp NGƯỜI DÙNG ĐÈ LÊN lớp VAI TRÒ (không cộng dồn OR nữa — OR
// khiến không thể nào THU HỒI quyền riêng cho 1 người nếu vai trò của họ đã
// được cấp, tick tắt trên tab "Theo người dùng" trông như có tác dụng nhưng
// thực ra vô nghĩa, gây hiểu lầm là lỗi):
// - feature_permissions: theo VAI TRÒ (tab "Theo vai trò") — áp dụng MẶC ĐỊNH
//   cho mọi người thuộc vai trò đó.
// - user_feature_permissions: theo TỪNG NGƯỜI DÙNG (tab "Theo người dùng") —
//   MỘT KHI đã có ít nhất 1 dòng cho feature này của người đó, dòng đó là
//   NGUỒN DUY NHẤT quyết định (dù cấp thêm hay thu hồi so với vai trò),
//   hoàn toàn bỏ qua feature_permissions cho đúng feature/người đó. Chưa có
//   dòng riêng thì vẫn dùng mặc định theo vai trò như bình thường.
export async function canAccessFeature(actor: FeatureAccessActor, feature: PermissionFeatureKey): Promise<boolean> {
  if (actor.role === ROLES.ADMIN) return true;

  const userRow = await prisma.userFeaturePermission.findUnique({ where: { userEmail_feature: { userEmail: actor.email, feature } } });
  if (userRow) return grantsAccess(userRow);

  const roleRow = await prisma.featurePermission.findUnique({ where: { feature_role: { feature, role: actor.role } } });
  return grantsAccess(roleRow);
}

// Đang trong giai đoạn thử nghiệm — CHƯA áp dụng chặn cứng ở tầng router
// (redirect "/access-denied"), chỉ ẩn/hiện mục nav theo quyền thật (xem
// getAccessibleHrefsForUser bên dưới). Lý do: cấu hình quyền cho từng
// trang/người còn đang hoàn thiện dần, chặn cứng ngay lúc này dễ tự khoá
// nhầm người dùng thật ra khỏi trang họ cần dùng hằng ngày. Vẫn giữ nguyên
// lời gọi requireFeatureAccess() ở mọi trang (không xoá) để bật lại chặn
// cứng sau này — chỉ cần đổi đúng hằng số ENFORCE_PAGE_ACCESS này.
const ENFORCE_PAGE_ACCESS = false;

export async function requireFeatureAccess(actor: FeatureAccessActor, feature: PermissionFeatureKey) {
  if (!ENFORCE_PAGE_ACCESS) return;
  if (!(await canAccessFeature(actor, feature))) {
    redirect("/access-denied");
  }
}

// Danh sách href (mục nav) mà actor hiện tại được vào — dùng để ẩn/hiện mục
// nav ở sidebar (getNavGroupsForRole ở lib/nav.ts). Href nào không nằm trong
// PERMISSION_FEATURES (Dashboard tổng, nhóm Quản trị, Nhật ký...) không bị
// chặn — luôn hiện với mọi vai trò đã đăng nhập. Cùng quy tắc "người dùng đè
// vai trò" như canAccessFeature() ở trên.
export async function getAccessibleHrefsForUser(actor: FeatureAccessActor): Promise<string[]> {
  if (actor.role === ROLES.ADMIN) return PERMISSION_FEATURES.map((f) => f.href);

  const [roleRows, userRows] = await Promise.all([
    prisma.featurePermission.findMany({ where: { role: actor.role } }),
    prisma.userFeaturePermission.findMany({ where: { userEmail: actor.email } }),
  ]);
  const roleGrant = new Map(roleRows.map((r) => [r.feature, grantsAccess(r)]));
  const userGrant = new Map(userRows.map((r) => [r.feature, grantsAccess(r)]));

  return PERMISSION_FEATURES.filter((f) => (userGrant.has(f.key) ? userGrant.get(f.key) : (roleGrant.get(f.key) ?? false))).map((f) => f.href);
}
