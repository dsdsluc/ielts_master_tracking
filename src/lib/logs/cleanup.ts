import "server-only";
// Dọn dẹp System Log theo lựa chọn thủ công — bảng này chỉ tăng theo thời
// gian nên cần cho Admin xoá bớt, nhưng KHÔNG tự động xoá theo tuổi vì có thể
// có thao tác chưa được xem/kiểm tra kỹ. Admin phải tự tích chọn từng dòng đã
// xem qua rồi mới xoá. Luôn ghi lại 1 dòng log mới (CLEANUP_SYSTEM_LOGS) SAU
// khi xoá xong — dòng này chắc chắn không nằm trong danh sách vừa xoá.
import { prisma } from "@/lib/prisma";
import { ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { logAction } from "@/lib/interactions/audit";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

const MAX_DELETE_AT_ONCE = 500;

export async function deleteSystemLogs(actor: CurrentUser, logIds: string[]): Promise<number> {
  if (actor.role !== ROLES.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Chỉ Quản trị hệ thống được dọn dẹp System Log.");
  }
  const ids = [...new Set(logIds)].filter(Boolean);
  if (ids.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng chọn ít nhất 1 dòng để xoá.");
  }
  if (ids.length > MAX_DELETE_AT_ONCE) {
    throw new ApiError(422, "VALIDATION_ERROR", `Chỉ được xoá tối đa ${MAX_DELETE_AT_ONCE} dòng mỗi lần.`);
  }

  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.systemLog.deleteMany({ where: { logId: { in: ids } } });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.CLEANUP_SYSTEM_LOGS, null, null, { deletedCount: count, deletedLogIds: ids });
    return count;
  });

  return count;
}
