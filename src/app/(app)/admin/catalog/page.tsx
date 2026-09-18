import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { BranchesPanel } from "@/app/(app)/admin/branches/branches-panel";
import { SourcesPanel } from "@/app/(app)/admin/sources/sources-panel";
import { FanpagesPanel } from "@/app/(app)/admin/fanpages/fanpages-panel";
import { StatusesPanel } from "@/app/(app)/admin/statuses/statuses-panel";
import { ObjectsPanel } from "@/app/(app)/admin/objects/objects-panel";
import { AdminCatalogTabs } from "@/app/(app)/admin/catalog/admin-catalog-tabs";

// Gộp 3 trang cấu hình danh mục dùng chung (Cơ sở/Nguồn/Fanpage) — trước đây
// mỗi thứ 1 route riêng ở nav, giờ chỉ còn 1 mục "Danh mục" chia tab. Dữ liệu
// và hành động (dialog tạo/sửa, actions.ts) giữ nguyên ở đúng thư mục gốc của
// từng loại (branches/sources/fanpages) — chỉ thêm 1 "panel" bọc lại phần
// bảng để nhúng vào tab thay vì lặp code.
export default async function AdminCatalogPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "adminCatalog");

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Danh mục"
        description="Cơ sở, Nguồn, Fanpage, Trạng thái và Đối tượng khách hàng dùng chung trong hệ thống — gộp về 1 nơi quản lý."
      />

      <AdminCatalogTabs
        branchesPanel={<BranchesPanel />}
        sourcesPanel={<SourcesPanel />}
        fanpagesPanel={<FanpagesPanel />}
        statusesPanel={<StatusesPanel />}
        objectsPanel={<ObjectsPanel />}
      />
    </>
  );
}
