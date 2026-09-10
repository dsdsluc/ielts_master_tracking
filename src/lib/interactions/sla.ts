import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { logAction } from "@/lib/interactions/audit";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

const MAX_FLAG_AT_ONCE = 200;

/** Admin tick chọn ở trang "Rà soát SLA" rồi đánh dấu ghi nhận — chỉ để theo
 * dõi/báo cáo trách nhiệm, KHÔNG đổi trạng thái, Workspace hay hành vi nào
 * khác của liên hệ. Bỏ qua các dòng đã được đánh dấu trước đó (idempotent). */
export async function flagSlaBreaches(actor: CurrentUser, interactionIds: string[]): Promise<number> {
  if (actor.role !== ROLES.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Chỉ Quản trị hệ thống được đánh dấu SLA.");
  }
  const ids = [...new Set(interactionIds)].filter(Boolean);
  if (ids.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng chọn ít nhất 1 liên hệ.");
  }
  if (ids.length > MAX_FLAG_AT_ONCE) {
    throw new ApiError(422, "VALIDATION_ERROR", `Chỉ được đánh dấu tối đa ${MAX_FLAG_AT_ONCE} liên hệ mỗi lần.`);
  }

  const now = new Date();
  const flaggedCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.interaction.updateMany({
      where: { interactionId: { in: ids }, slaFlagged: false },
      data: { slaFlagged: true, slaFlaggedAt: now, slaFlaggedByEmail: actor.email },
    });
    if (count > 0) {
      await logAction(tx, actor, SYSTEM_LOG_ACTION.FLAG_SLA_BREACH, null, null, { flaggedCount: count, interactionIds: ids });
    }
    return count;
  });

  return flaggedCount;
}
