import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { isLeaderLike } from "@/lib/interactions/scope";
import type { CurrentUser } from "@/lib/auth/dal";

/** Khách hàng không có branchCode riêng — phạm vi xem suy ra từ cơ sở của
 * các Interaction thuộc về khách đó (mirror branchScopeWhere trong
 * lib/interactions/queries.ts nhưng qua quan hệ interactions). Dùng chung
 * giữa trang /customers và route export. */
export function customerScopeWhere(actor: CurrentUser): Prisma.CustomerWhereInput {
  if (isLeaderLike(actor)) return {};
  if (actor.role === ROLES.SALES) {
    return { interactions: { some: { assignedBranchCode: actor.branchCode ?? "__NONE__" } } };
  }
  if (actor.viewAllBranches) return {};
  return actor.branchCode ? { interactions: { some: { assignedBranchCode: actor.branchCode } } } : {};
}

/** Trang "Khách hàng" chỉ hiển thị khách đã Đủ tiêu chuẩn (có SĐT) — dùng
 * chung giữa trang /customers và route export để 2 nơi luôn khớp nhau. */
export function qualifiedCustomerWhere(): Prisma.CustomerWhereInput {
  return { currentStatusName: STATUS.PHONE, phoneNormalized: { not: null } };
}
