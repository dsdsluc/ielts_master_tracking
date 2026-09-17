// Tách riêng type/label dùng chung cho UI + (sau này) actions.ts — mirror
// pattern các trang admin khác (vd. lib/interactions/constants.ts cho STATUS).
import { ROLES } from "@/lib/interactions/constants";

export const PERMISSION_ACTIONS = [
  { key: "canCreate", label: "Thêm" },
  { key: "canEdit", label: "Sửa" },
  { key: "canDelete", label: "Xóa" },
  { key: "canReport", label: "Báo cáo" },
] as const;

export type PermissionActionKey = (typeof PERMISSION_ACTIONS)[number]["key"];

// Các vai trò được phân quyền — Admin luôn có đủ quyền mặc định (không hiện
// dòng riêng), mở rộng thêm vai trò khác sau này chỉ cần thêm vào mảng này.
export const PERMISSION_ROLES = [ROLES.MARKETING, ROLES.SALES, ROLES.LEADER] as const;

// Mỗi tính năng có 1 section riêng ở trang /admin/permissions, cùng dùng
// chung PERMISSION_ACTIONS/PERMISSION_ROLES ở trên — mở rộng thêm tính năng
// khác sau này chỉ cần thêm vào mảng này. 1 feature = đúng 1 mục nav (`href`)
// — tick BẤT KỲ cột nào trong 4 cột (Thêm/Sửa/Xóa/Báo cáo) cho 1 vai trò là
// đủ để vai trò đó vào được route tương ứng (chỉ chặn ở mức router, chưa phân
// quyền sâu từng hành động — xem requireFeatureAccess() ở lib/auth/feature-access.ts).
// `group` chỉ dùng để chia section hiển thị cho khớp nhóm nav ở lib/nav.ts.
export const PERMISSION_FEATURES = [
  { key: "dashboard", label: "Dashboard", href: "/", group: "Tổng quan" },
  { key: "dashboardSale", label: "Dashboard Sale", href: "/dashboard-sale", group: "Saler" },
  { key: "interactions", label: "Liên hệ", href: "/leads", group: "Saler" },
  { key: "workspace", label: "Workspace của tôi", href: "/workspace", group: "Saler" },
  { key: "followupInbox", label: "Cần chăm sóc lại", href: "/followup-inbox", group: "Saler" },
  { key: "saleOverview", label: "Tổng quan Sale", href: "/sale-overview", group: "Saler" },
  { key: "leaderDashboard", label: "Dashboard Leader", href: "/leader-dashboard", group: "Leader" },
  { key: "customers", label: "Khách hàng", href: "/customers", group: "Leader" },
  { key: "leadsImport", label: "Nhập từ Excel", href: "/leads/import", group: "Leader" },
  { key: "marketingDashboard", label: "Dashboard Marketing", href: "/marketing-dashboard", group: "Marketing" },
  { key: "marketingWorkspace", label: "Workspace Marketing", href: "/marketing-workspace", group: "Marketing" },
  { key: "adIds", label: "Ad ID", href: "/ad-ids", group: "Marketing" },
  { key: "followup", label: "Chăm sóc lại", href: "/followup", group: "Marketing" },
  { key: "adminMonitoring", label: "Trung tâm quản trị", href: "/admin/monitoring", group: "Quản trị" },
  { key: "spamReview", label: "Xử lý Spam", href: "/admin/spam-review", group: "Quản trị" },
  { key: "newAdIds", label: "Ad ID mới", href: "/admin/new-ad-ids", group: "Quản trị" },
  { key: "missingConversation", label: "Thiếu link hội thoại", href: "/admin/missing-conversation", group: "Quản trị" },
  { key: "pageReportClosed", label: "Tổng quan báo cáo đã chốt", href: "/page-report/closed", group: "Quản trị" },
  { key: "adminCatalog", label: "Danh mục", href: "/admin/catalog", group: "Quản trị" },
  { key: "adminPermissions", label: "Phân quyền", href: "/admin/permissions", group: "Quản trị" },
  { key: "logs", label: "Nhật ký hoạt động", href: "/logs", group: "Nhật ký" },
] as const;

export type PermissionFeatureKey = (typeof PERMISSION_FEATURES)[number]["key"];

export type PermissionRow = {
  role: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
};
