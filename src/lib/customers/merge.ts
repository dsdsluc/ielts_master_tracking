// Gộp N bản ghi Customer trùng (cùng SĐT, khác Link chuẩn) thành 1: chuyển hết
// Interaction của các bản ghi bị xoá sang bản ghi giữ lại, áp thông tin Sale
// đã xem đầy đủ + tự chỉnh (Tên/SĐT/Link chuẩn/Trạng thái — không tự suy luận
// ngầm nữa), rồi xoá các bản ghi thừa.
import { prisma } from "@/lib/prisma";
import { CAN_CREATE_OR_EDIT_LEAD, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { requireRole, canAccessBranch } from "@/lib/interactions/scope";
import { logAction } from "@/lib/interactions/audit";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

const VALID_STATUSES: readonly string[] = Object.values(STATUS);

export type MergeCustomerUpdates = {
  displayName: string;
  phoneNormalized: string | null;
  canonicalLink: string;
  currentStatusName: string;
};

export async function mergeCustomers(
  actor: CurrentUser,
  keepCustomerKey: string,
  removeCustomerKeys: string[],
  updates: MergeCustomerUpdates
) {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);

  const removeKeys = [...new Set(removeCustomerKeys)].filter((k) => k !== keepCustomerKey);
  if (removeKeys.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Không có bản ghi nào để gộp.");
  }
  if (!updates.displayName.trim()) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập tên khách hàng.");
  }
  if (!updates.canonicalLink.trim()) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập Link chuẩn.");
  }
  if (!VALID_STATUSES.includes(updates.currentStatusName)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Trạng thái không hợp lệ.");
  }

  const allKeys = [keepCustomerKey, ...removeKeys];
  const customers = await prisma.customer.findMany({
    where: { customerKey: { in: allKeys } },
    include: {
      interactions: { select: { interactionId: true, assignedBranchCode: true, createdLeadAt: true } },
    },
  });
  if (customers.length !== allKeys.length) {
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy đủ các bản ghi khách hàng — có thể đã được gộp trước đó.");
  }

  const keepCustomer = customers.find((c) => c.customerKey === keepCustomerKey);
  if (!keepCustomer) {
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy bản ghi chính.");
  }
  const removeCustomers = customers.filter((c) => c.customerKey !== keepCustomerKey);

  // Customer không có branchCode riêng — quyền truy cập suy ra từ cơ sở của
  // TỪNG interaction đang thuộc về các bản ghi liên quan (giống customerScopeWhere).
  const allInteractions = customers.flatMap((c) => c.interactions);
  for (const i of allInteractions) {
    if (!canAccessBranch(actor, i.assignedBranchCode)) {
      throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền gộp khách hàng có liên hệ thuộc cơ sở khác.");
    }
  }

  // firstTouchAt là mốc thời gian theo dõi, không phải nội dung Sale gõ tay —
  // tự tính lại từ toàn bộ interaction sau khi gộp cho đúng thực tế, không hỏi qua form.
  const firstTouchAt = allInteractions.reduce(
    (min, i) => (i.createdLeadAt < min ? i.createdLeadAt : min),
    keepCustomer.firstTouchAt
  );

  const merged = await prisma.$transaction(async (tx) => {
    for (const c of removeCustomers) {
      await tx.interaction.updateMany({ where: { customerKey: c.customerKey }, data: { customerKey: keepCustomerKey } });
    }
    // Xoá các bản ghi thừa TRƯỚC khi đổi Link chuẩn của bản ghi giữ lại — nếu
    // Sale chọn giữ đúng Link chuẩn của 1 bản ghi SẮP bị xoá, đổi trước khi xoá
    // sẽ đụng ràng buộc unique (2 Customer không được trùng canonicalLink).
    await tx.customer.deleteMany({ where: { customerKey: { in: removeCustomers.map((c) => c.customerKey) } } });
    const updated = await tx.customer.update({
      where: { customerKey: keepCustomerKey },
      data: {
        displayName: updates.displayName.trim(),
        phoneNormalized: updates.phoneNormalized,
        canonicalLink: updates.canonicalLink.trim(),
        currentStatusName: updates.currentStatusName,
        firstTouchAt,
        lastTouchAt: new Date(),
      },
    });
    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.MERGE_CUSTOMERS,
      null,
      { removed: removeCustomers.map((c) => ({ customerKey: c.customerKey, displayName: c.displayName, canonicalLink: c.canonicalLink })) },
      { keptCustomerKey: keepCustomerKey, ...updates }
    );
    return updated;
  });

  return merged;
}
