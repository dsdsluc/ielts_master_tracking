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
} from "lucide-react";
import {
  ROLES,
  CAN_REASSIGN,
} from "@/lib/interactions/constants";

type AppRole = (typeof ROLES)[keyof typeof ROLES];

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  allowedRoles: readonly AppRole[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const REPORT_ROLES = [
  ROLES.LEADER,
  ROLES.MARKETING,
  ROLES.BOARD,
  ROLES.ADMIN,
] as const;
// Mỗi vai trò chỉ thấy đúng nhóm nav của mình — Admin luôn thấy tất cả nhóm.
// Leader không thấy nhóm "Marketing" qua nav (vẫn có thể thao tác thay
// Marketing nếu nghiệp vụ cho phép, chỉ là không lộ ra sidebar — xem "Menu chỉ
// là lớp trình bày" ở dưới). Nhóm "Saler" thì Leader vẫn thấy đầy đủ — Leader
// cũng là Saler theo nghiệp vụ, cần xem/dùng được toàn bộ công cụ của Sale
// (Dashboard Sale, Liên hệ, Workspace, Chăm sóc lại, Tổng quan Sale) bên cạnh
// "Dashboard Leader" riêng của mình.
const SALER_NAV_ROLES = [ROLES.SALES, ROLES.LEADER, ROLES.ADMIN] as const;
const MARKETING_NAV_ROLES = [ROLES.MARKETING, ROLES.ADMIN] as const;
const ADMIN_ROLES = [ROLES.ADMIN] as const;

// Sale/Admin không được vào trang Dashboard tổng ("/") — home của họ là
// Dashboard Sale. Các vai trò còn lại (Marketing, Leader, BGĐ, Admin) đều có
// quyền vào "/".
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

/**
 * Menu chỉ là lớp trình bày. Các page/API vẫn phải kiểm tra quyền ở server.
 * Trả về nhóm mới để navGroups gốc không bị mutate giữa các request/user.
 */
export function getNavGroupsForRole(role: string): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (item.allowedRoles as readonly string[]).includes(role),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export const navGroups: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        allowedRoles: REPORT_ROLES,
      },
    ],
  },
  {
    label: "Saler",
    items: [
      {
        title: "Dashboard Sale",
        href: "/dashboard-sale",
        icon: Gauge,
        allowedRoles: SALER_NAV_ROLES,
      },
      {
        title: "Liên hệ",
        href: "/leads",
        icon: Inbox,
        // NAV dùng SALER_NAV_ROLES (Sale/Leader/Admin) — hẹp hơn CAN_VIEW_LEAD
        // (quyền server, có thêm cả Marketing). Trang /leads vẫn kiểm tra
        // quyền riêng ở server, không phụ thuộc danh sách này.
        allowedRoles: SALER_NAV_ROLES,
      },
      {
        title: "Workspace của tôi",
        href: "/workspace",
        icon: Briefcase,
        allowedRoles: SALER_NAV_ROLES,
      },
      {
        title: "Cần chăm sóc lại",
        href: "/followup-inbox",
        icon: Sparkles,
        allowedRoles: SALER_NAV_ROLES,
      },
      {
        title: "Tổng quan Sale",
        href: "/sale-overview",
        icon: LayoutGrid,
        allowedRoles: SALER_NAV_ROLES,
      },
      // "Học viên đang tư vấn" (/students) đã gộp vào "Workspace của tôi" —
      // ẩn khỏi menu, route vẫn còn dùng được nếu truy cập trực tiếp.
    ],
  },
  {
    label: "Leader",
    items: [
      {
        title: "Dashboard Leader",
        href: "/leader-dashboard",
        icon: Gauge,
        allowedRoles: CAN_REASSIGN,
      },
      // "Phân bổ chăm sóc lại", "Theo dõi hiệu quả chăm sóc lại" (chuyển sang
      // nhóm Marketing — Leader/Admin không cần nữa) và "Phân bổ học viên" đã
      // gộp thành các mục bấm được ngay trên Dashboard Leader — không còn là
      // mục nav riêng để Leader chỉ cần vào 1 trang là làm được mọi việc.
      {
        title: "Khách hàng",
        href: "/customers",
        icon: Users,
        allowedRoles: CAN_REASSIGN,
      },
      {
        title: "Nhập từ Excel",
        href: "/leads/import",
        icon: FileSpreadsheet,
        allowedRoles: CAN_REASSIGN,
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "Dashboard Marketing",
        href: "/marketing-dashboard",
        icon: Gauge,
        allowedRoles: MARKETING_NAV_ROLES,
      },
      {
        title: "Workspace Marketing",
        href: "/marketing-workspace",
        icon: Briefcase,
        allowedRoles: MARKETING_NAV_ROLES,
      },
      {
        title: "Ad ID",
        href: "/ad-ids",
        icon: Fingerprint,
        allowedRoles: MARKETING_NAV_ROLES,
      },
      {
        title: "Chăm sóc lại",
        href: "/followup",
        icon: Sparkles,
        // Trước đây dùng CAN_PUSH_FOLLOWUP (quyền server, có cả Leader) —
        // riêng ở NAV chỉ Marketing/Admin cần thấy, Leader có Dashboard Leader
        // riêng. Route vẫn nhận Leader nếu truy cập trực tiếp.
        allowedRoles: MARKETING_NAV_ROLES,
      },
      // "Theo dõi hiệu quả chăm sóc lại" (/followup-tracking) là việc của
      // Leader, không phải Marketing — đã gỡ khỏi nhóm này. Leader xem qua
      // mục bấm được ngay trên Dashboard Leader (xem comment ở nhóm Leader).
    ],
  },
  // Nhóm "Thống kê" (Chi phí quảng cáo / Nhập chi phí từ Excel / Hiệu quả
  // quảng cáo) đã gỡ khỏi nav — cả 3 đều bấm được ngay trong Workspace
  // Marketing (thêm/nhập chi phí, xem chi phí gần đây, xếp hạng hiệu quả),
  // kèm link "Xem tất cả" sang đúng 3 route này khi cần xem đầy đủ.
  {
    label: "Quản trị",
    items: [
      {
        title: "Trung tâm quản trị",
        href: "/admin/monitoring",
        icon: ShieldAlert,
        allowedRoles: ADMIN_ROLES,
      },
      {
        title: "Tổng quan báo cáo đã chốt",
        href: "/page-report/closed",
        icon: ClipboardCheck,
        allowedRoles: ADMIN_ROLES,
      },
      {
        title: "Danh mục",
        href: "/admin/catalog",
        icon: Building2,
        allowedRoles: ADMIN_ROLES,
      },
      // "Rà soát SLA", "Người dùng", "Cấu hình hệ thống" đã gộp thành section
      // trong trang "Trung tâm quản trị" (/admin/monitoring) — không còn là mục riêng ở đây.
    ],
  },
  {
    label: "Nhật ký",
    items: [
      {
        title: "Nhật ký hoạt động",
        href: "/logs",
        icon: ScrollText,
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
];
