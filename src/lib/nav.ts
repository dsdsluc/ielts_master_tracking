import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Gauge,
  Inbox,
  Users,
  Megaphone,
  Building2,
  Flag,
  Share2,
  CircleDot,
  Tag,
  UserCog,
  SlidersHorizontal,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import { ROLES, CAN_VIEW_LEAD } from "@/lib/interactions/constants";

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

const REPORT_ROLES = [ROLES.LEADER, ROLES.MARKETING, ROLES.BOARD, ROLES.ADMIN] as const;
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
  // Khớp tuyệt đối trước — "/admin" và "/admin/users" đều là href hợp lệ,
  // nếu ưu tiên startsWith thì "/admin" (duyệt trước trong mảng) sẽ nuốt mất
  // path của mọi trang con /admin/*.
  const exact = allItems.find((item) => item.href === pathname);
  if (exact) return exact.title;
  const prefixMatch = allItems.find((item) => item.href !== "/" && pathname.startsWith(`${item.href}/`));
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
        (item.allowedRoles as readonly string[]).includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export const navGroups: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard, allowedRoles: REPORT_ROLES },
      {
        title: "Dashboard Sale",
        href: "/dashboard-sale",
        icon: Gauge,
        allowedRoles: SALE_WORKSPACE_ROLES,
      },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { title: "Liên hệ", href: "/leads", icon: Inbox, allowedRoles: LEAD_ROLES },
      {
        title: "Khách hàng",
        href: "/customers",
        icon: Users,
        allowedRoles: SALE_WORKSPACE_ROLES,
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        title: "Chi phí quảng cáo",
        href: "/ads-cost",
        icon: Megaphone,
        allowedRoles: [ROLES.MARKETING, ROLES.ADMIN],
      },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { title: "Giám sát", href: "/admin", icon: ShieldAlert, allowedRoles: ADMIN_ROLES },
      { title: "Cơ sở", href: "/admin/branches", icon: Building2, allowedRoles: ADMIN_ROLES },
      { title: "Fanpage", href: "/admin/fanpages", icon: Flag, allowedRoles: ADMIN_ROLES },
      { title: "Nguồn", href: "/admin/sources", icon: Share2, allowedRoles: ADMIN_ROLES },
      { title: "Trạng thái", href: "/admin/statuses", icon: CircleDot, allowedRoles: ADMIN_ROLES },
      { title: "Đối tượng", href: "/admin/objects", icon: Tag, allowedRoles: ADMIN_ROLES },
      { title: "Người dùng", href: "/admin/users", icon: UserCog, allowedRoles: ADMIN_ROLES },
      {
        title: "Cấu hình hệ thống",
        href: "/admin/settings",
        icon: SlidersHorizontal,
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },
  {
    label: "Nhật ký",
    items: [
      { title: "System Log", href: "/logs", icon: ScrollText, allowedRoles: ADMIN_ROLES },
    ],
  },
];
