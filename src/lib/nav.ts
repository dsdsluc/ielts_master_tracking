import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Gauge,
  Inbox,
  Users,
  Megaphone,
  Building2,
  Tag,
  History,
  FileSpreadsheet,
  LayoutGrid,
  ScrollText,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Briefcase,
  ClipboardCheck,
  UserRoundPlus,
} from "lucide-react";
import {
  ROLES,
  CAN_VIEW_LEAD,
  CAN_PUSH_FOLLOWUP,
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
const SALE_WORKSPACE_ROLES = [ROLES.SALES, ROLES.LEADER, ROLES.ADMIN] as const;
const LEAD_ROLES = CAN_VIEW_LEAD;
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
      {
        title: "Dashboard Sale",
        href: "/dashboard-sale",
        icon: Gauge,
        allowedRoles: SALE_WORKSPACE_ROLES,
      },
    ],
  },
  {
    label: "Saler",
    items: [
      {
        title: "Liên hệ",
        href: "/leads",
        icon: Inbox,
        allowedRoles: LEAD_ROLES,
      },
      {
        title: "Workspace của tôi",
        href: "/workspace",
        icon: Briefcase,
        allowedRoles: SALE_WORKSPACE_ROLES,
      },
      {
        title: "Cần chăm sóc lại",
        href: "/followup-inbox",
        icon: Sparkles,
        allowedRoles: SALE_WORKSPACE_ROLES,
      },
      {
        title: "Tổng quan Sale",
        href: "/sale-overview",
        icon: LayoutGrid,
        allowedRoles: SALE_WORKSPACE_ROLES,
      },
      // "Học viên đang tư vấn" (/students) đã gộp vào "Workspace của tôi" —
      // ẩn khỏi menu, route vẫn còn dùng được nếu truy cập trực tiếp.
    ],
  },
  {
    label: "Leader",
    items: [
      {
        title: "Chăm sóc lại",
        href: "/followup",
        icon: Sparkles,
        allowedRoles: CAN_PUSH_FOLLOWUP,
      },
      {
        title: "Theo dõi hiệu quả chăm sóc lại",
        href: "/followup-tracking",
        icon: History,
        allowedRoles: CAN_PUSH_FOLLOWUP,
      },
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
      {
        title: "Phân bổ học viên",
        href: "/student-assignment",
        icon: UserRoundPlus,
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
        allowedRoles: [ROLES.MARKETING, ROLES.ADMIN],
      },
      {
        title: "Workspace Marketing",
        href: "/marketing-workspace",
        icon: Briefcase,
        allowedRoles: [ROLES.MARKETING, ROLES.ADMIN],
      },
    ],
  },
  {
    label: "Thống kê",
    items: [
      {
        title: "Chi phí quảng cáo",
        href: "/ads-cost",
        icon: Megaphone,
        allowedRoles: [ROLES.MARKETING, ROLES.ADMIN],
      },
      {
        title: "Nhập chi phí từ Excel",
        href: "/ads-cost/import",
        icon: FileSpreadsheet,
        allowedRoles: [ROLES.MARKETING, ROLES.ADMIN],
      },
      {
        title: "Hiệu quả quảng cáo",
        href: "/ads-performance",
        icon: TrendingUp,
        allowedRoles: [ROLES.MARKETING, ROLES.ADMIN],
      },
    ],
  },
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
      {
        title: "Đối tượng",
        href: "/admin/objects",
        icon: Tag,
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
        title: "System Log",
        href: "/logs",
        icon: ScrollText,
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
];
