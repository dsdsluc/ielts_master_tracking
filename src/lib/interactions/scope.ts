// Port của AuthService.gs (canAccessBranch_, canViewLead_, canEditConversationInfo_,
// canEditLeadResult_, requireValidSaleBranchScope_...) — quyết định Sale/Leader/
// Marketing/BGĐ/Admin được xem và sửa gì, theo đúng vai trò + cơ sở.
import { ROLES } from "@/lib/interactions/constants";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

export function isLeaderLike(user: CurrentUser): boolean {
  return user.role === ROLES.LEADER || user.role === ROLES.ADMIN;
}

export function canViewAllBranches(user: CurrentUser): boolean {
  // Sale/Admin luôn bị khóa đúng một cơ sở — cờ viewAllBranches không mở rộng phạm vi cho vai trò này.
  if (user.role === ROLES.SALES) return false;
  return isLeaderLike(user) || user.viewAllBranches;
}

export function canAccessBranch(user: CurrentUser, branchCode: string): boolean {
  if (user.role === ROLES.SALES) {
    return !!user.branchCode && user.branchCode === branchCode;
  }
  if (canViewAllBranches(user)) return true;
  return !user.branchCode || user.branchCode === branchCode;
}

/** BGĐ chỉ xem báo cáo tổng hợp, không xem từng lead riêng lẻ. */
export function canViewLead(user: CurrentUser, assignedBranchCode: string): boolean {
  if (user.role === ROLES.BOARD) return false;
  if (isLeaderLike(user)) return true;
  return canAccessBranch(user, assignedBranchCode);
}

export function requireValidSaleBranchScope(user: CurrentUser): void {
  if (user.role !== ROLES.SALES) return;
  if (!user.branchCode) {
    throw new ApiError(
      403,
      "INVALID_BRANCH_SCOPE",
      "Tài khoản Sale/Admin chưa được gán đúng một cơ sở đang hoạt động. Vui lòng liên hệ Quản trị hệ thống."
    );
  }
  if (user.viewAllBranches) {
    throw new ApiError(
      403,
      "INVALID_BRANCH_SCOPE",
      "Tài khoản Sale/Admin đang có quyền xem tất cả cơ sở — Quản trị cần tắt trước khi tiếp tục."
    );
  }
}

export function requireRole(user: CurrentUser, roles: readonly string[]): void {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", `Vai trò ${user.role} không được thực hiện chức năng này.`);
  }
}
