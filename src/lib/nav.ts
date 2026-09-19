import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Gauge,
  Inbox,
  Users,
  Building2,
  FileSpreadsheet,
  Fingerprint,
  LayoutGrid,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Briefcase,
  ClipboardCheck,
  KeyRound,
  ShieldOff,
  ListPlus,
  MessageCircleOff,
  CalendarRange,
  ClipboardList,
} from "lucide-react";
import { ROLES } from "@/lib/interactions/constants";
import { PERMISSION_FEATURES } from "@/app/(app)/admin/permissions/permission-types";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Saler không được vào trang Dashboard tổng ("/") — home của họ là
// Dashboard Sale. Các vai trò còn lại đều có quyền vào "/".
export function getHomePathForRole(role: string): string {
  return role === ROLES.SALES ? "/dashboard-sale" : "/";
}

export function getNavTitle(pathname: string): string {
  const allItems = navGroups.flatMap((g) => g.items);
  // Khớp tuyệt đối trước — "/admin/monitoring" và "/admin/objects" đều là href
  // hợp lệ, nếu ưu tiên startsWith thì mục duyệt trước trong mảng có thể nuốt
  // mất path của các trang con /admin/* khác.
  const exact = allItems.find((item) => item.href === pathname);
  if (exact) return exact.title;
  const prefixMatch = allItems.find(
    (item) => item.href !== "/" && pathname.startsWith(`${item.href}/`),
  );
  return prefixMatch?.title ?? "Theo dõi Liên hệ";
}

// Href nào khớp 1 tính năng trong PERMISSION_FEATURES (xem admin/permissions)
// là mục bị chặn theo phân quyền — href còn lại (Dashboard tổng, Quản trị,
// Nhật ký...) luôn hiện với mọi vai trò đã đăng nhập.
const GATED_HREFS = new Set<string>(PERMISSION_FEATURES.map((f) => f.href));

// `accessibleHrefs` lấy từ getAccessibleHrefsForUser() (lib/auth/feature-access.ts)
// — tính sẵn theo actor (role + email, hợp nhất quyền cấp vai trò lẫn cấp
// người dùng) ở Server Component (layout.tsx) rồi truyền xuống vì SidebarNav
// là Client Component, không tự query DB được. Admin đã được trả về đủ
// accessibleHrefs (toàn bộ PERMISSION_FEATURES) nên không cần check riêng ở đây.
export function getNavGroupsForRole(accessibleHrefs: readonly string[]): NavGroup[] {
  const allowed = new Set(accessibleHrefs);
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !GATED_HREFS.has(item.href) || allowed.has(item.href)),
    }))
    .filter((group) => group.items.length > 0);
}

export const navGroups: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Saler",
    items: [
      { title: "Dashboard Sale", href: "/dashboard-sale", icon: Gauge },
      { title: "Báo cáo cuối ngày", href: "/daily-report", icon: ClipboardList },
      { title: "Liên hệ", href: "/leads", icon: Inbox },
      { title: "Workspace của tôi", href: "/workspace", icon: Briefcase },
      { title: "Cần chăm sóc lại", href: "/followup-inbox", icon: Sparkles },
      { title: "Tổng quan Sale", href: "/sale-overview", icon: LayoutGrid },
    ],
  },
  {
    label: "Leader",
    items: [
      { title: "Dashboard Leader", href: "/leader-dashboard", icon: Gauge },
      // "Phân bổ chăm sóc lại", "Theo dõi hiệu quả chăm sóc lại" (chuyển sang
      // nhóm Marketing) đã gộp thành mục bấm được ngay trên Dashboard Leader —
      // không còn là mục nav riêng.
      { title: "Khách hàng", href: "/customers", icon: Users },
      { title: "Nhập từ Excel", href: "/leads/import", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Dashboard Marketing", href: "/marketing-dashboard", icon: Gauge },
      { title: "Workspace Marketing", href: "/marketing-workspace", icon: Briefcase },
      { title: "Ad ID", href: "/ad-ids", icon: Fingerprint },
      { title: "Chăm sóc lại", href: "/followup", icon: Sparkles },
    ],
  },
  // Nhóm "Thống kê" (Chi phí quảng cáo / Nhập chi phí từ Excel / Hiệu quả
  // quảng cáo) đã gỡ khỏi nav — cả 3 đều bấm được ngay trong Workspace
  // Marketing, kèm link "Xem tất cả" sang đúng 3 route này khi cần xem đầy đủ.
  {
    label: "Quản trị",
    items: [
      { title: "Trung tâm quản trị", href: "/admin/monitoring", icon: ShieldAlert },
      { title: "Báo cáo tháng", href: "/admin/monthly-report", icon: CalendarRange },
      { title: "Xử lý Spam", href: "/admin/spam-review", icon: ShieldOff },
      { title: "Ad ID mới", href: "/admin/new-ad-ids", icon: ListPlus },
      { title: "Thiếu link hội thoại", href: "/admin/missing-conversation", icon: MessageCircleOff },
      { title: "Tổng quan báo cáo đã chốt", href: "/page-report/closed", icon: ClipboardCheck },
      { title: "Danh mục", href: "/admin/catalog", icon: Building2 },
      { title: "Phân quyền", href: "/admin/permissions", icon: KeyRound },
      // "Rà soát SLA", "Người dùng", "Cấu hình hệ thống" đã gộp thành section
      // trong trang "Trung tâm quản trị" (/admin/monitoring).
    ],
  },
  {
    label: "Nhật ký",
    items: [{ title: "Nhật ký hoạt động", href: "/logs", icon: ScrollText }],
  },
];
