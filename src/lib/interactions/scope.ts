// Port của AuthService.gs (canAccessBranch_, canViewLead_, canEditConversationInfo_,
// canEditLeadResult_, requireValidSaleBranchScope_...) — phạm vi cơ sở (branch scope)
// theo vai trò, tách biệt khỏi hệ phân quyền tính năng (đang xây lại từ đầu).
import { ROLES } from "@/lib/interactions/constants";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

export function isLeaderLike(user: CurrentUser): boolean {
  return user.role === ROLES.LEADER || user.role === ROLES.ADMIN;
}

export function canViewAllBranches(user: CurrentUser): boolean {
  // Saler luôn bị khóa đúng một cơ sở — cờ viewAllBranches không mở rộng phạm vi cho vai trò này.
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

export function canViewLead(user: CurrentUser, assignedBranchCode: string): boolean {
  if (isLeaderLike(user)) return true;
  return canAccessBranch(user, assignedBranchCode);
}

export function requireValidSaleBranchScope(user: CurrentUser): void {
  if (user.role !== ROLES.SALES) return;
  if (!user.branchCode) {
    throw new ApiError(
      403,
      "INVALID_BRANCH_SCOPE",
      "Tài khoản Saler chưa được gán đúng một cơ sở đang hoạt động. Vui lòng liên hệ Admin."
    );
  }
  if (user.viewAllBranches) {
    throw new ApiError(
      403,
      "INVALID_BRANCH_SCOPE",
      "Tài khoản Saler đang có quyền xem tất cả cơ sở — Admin cần tắt trước khi tiếp tục."
    );
  }
}

