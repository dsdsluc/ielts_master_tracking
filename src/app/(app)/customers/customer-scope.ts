import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ROLES } from "@/lib/interactions/constants";
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

export function customerSearchWhere(q: string | undefined, status: string | undefined): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (status) where.currentStatusName = status;
  if (q?.trim()) {
    const needle = q.trim();
    where.OR = [
      { displayName: { contains: needle, mode: "insensitive" } },
      { phoneNormalized: { contains: needle, mode: "insensitive" } },
      { customerKey: { contains: needle, mode: "insensitive" } },
    ];
  }
  return where;
}
