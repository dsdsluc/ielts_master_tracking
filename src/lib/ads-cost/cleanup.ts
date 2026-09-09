import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { logAction } from "@/lib/interactions/audit";
import { ApiError } from "@/lib/interactions/errors";
import { isAdsCostCleanupEnabled } from "@/lib/interactions/settings";
import type { CurrentUser } from "@/lib/auth/dal";

const MAX_DELETE_AT_ONCE = 500;

export async function deleteAdsCostRows(actor: CurrentUser, ids: number[]): Promise<number> {
  if (actor.role !== ROLES.MARKETING && actor.role !== ROLES.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Chỉ Marketing hoặc Quản trị hệ thống được dọn dẹp chi phí quảng cáo.");
  }
  const enabled = await isAdsCostCleanupEnabled();
  if (!enabled) {
    throw new ApiError(403, "FORBIDDEN", "Chức năng dọn dẹp đang tắt — bật trong Cấu hình hệ thống trước.");
  }
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (uniqueIds.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng chọn ít nhất 1 dòng để xoá.");
  }
  if (uniqueIds.length > MAX_DELETE_AT_ONCE) {
    throw new ApiError(422, "VALIDATION_ERROR", `Chỉ được xoá tối đa ${MAX_DELETE_AT_ONCE} dòng mỗi lần.`);
  }

  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.adsCost.deleteMany({ where: { id: { in: uniqueIds } } });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.CLEANUP_ADS_COST, null, null, { deletedCount: count, deletedIds: uniqueIds });
    return count;
  });

  return count;
}
