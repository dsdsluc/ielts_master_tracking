import "server-only";
import { prisma } from "@/lib/prisma";
import { CAN_CREATE_OR_EDIT_LEAD, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { canAccessBranch, requireRole } from "@/lib/interactions/scope";
import { logAction } from "@/lib/interactions/audit";
import { ApiError, Errors } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

const OPEN_STATUSES: string[] = [STATUS.WAITING, STATUS.PROCESSING];

// Nhiều Sale được phép cùng thêm 1 liên hệ vào "Workspace của tôi" — không còn
// khoá độc quyền như trước (Sale A nhận rồi thì Sale B vẫn nhận được). Mỗi Sale
// chỉ có đúng 1 dòng WorkspaceClaim cho 1 liên hệ (unique interactionId+saleEmail),
// bấm "Nhận" lần nữa chỉ cập nhật lastActivityAt chứ không lỗi.
async function claimOne(actor: CurrentUser, interactionId: string): Promise<void> {
  const lead = await prisma.interaction.findUnique({
    where: { interactionId },
    select: { assignedBranchCode: true, activeFlag: true, statusName: true },
  });
  if (!lead || !lead.activeFlag) throw Errors.notFound();
  if (!canAccessBranch(actor, lead.assignedBranchCode)) {
    throw Errors.forbidden("Bạn không được thao tác trên liên hệ này.");
  }
  if (!OPEN_STATUSES.includes(lead.statusName)) {
    throw new ApiError(409, "CONFLICT", "Liên hệ này đã đóng, không thể thêm vào Workspace.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.workspaceClaim.updateMany({
      where: { interactionId, saleEmail: actor.email },
      data: { lastActivityAt: now },
    });
    if (count > 0) return; // đã có sẵn trong Workspace — bấm lại chỉ làm mới hoạt động gần nhất.
    await tx.workspaceClaim.create({ data: { interactionId, saleEmail: actor.email, claimedAt: now, lastActivityAt: now } });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.ADD_TO_WORKSPACE, interactionId, null, { saleEmail: actor.email });
  });
}

export async function claimForWorkspace(actor: CurrentUser, interactionId: string): Promise<void> {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  await claimOne(actor, interactionId);
}

/** Xử lý tuần tự — mỗi liên hệ tự chịu trách nhiệm thành công/thất bại riêng,
 * 1 dòng không hợp lệ (đã đóng, sai phạm vi cơ sở...) không được làm hỏng cả lô. */
export async function claimManyForWorkspace(
  actor: CurrentUser,
  interactionIds: string[]
): Promise<{ claimed: string[]; conflicts: string[] }> {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  const claimed: string[] = [];
  const conflicts: string[] = [];
  for (const id of interactionIds) {
    try {
      await claimOne(actor, id);
      claimed.push(id);
    } catch {
      conflicts.push(id);
    }
  }
  return { claimed, conflicts };
}

/** Chỉ gỡ đúng lượt claim của actor — không đụng tới claim của Sale khác trên
 * cùng liên hệ (nhiều Sale có thể đang cùng theo dõi 1 liên hệ). */
export async function releaseFromWorkspace(actor: CurrentUser, interactionId: string): Promise<void> {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);

  const released = await prisma.$transaction(async (tx) => {
    const { count } = await tx.workspaceClaim.deleteMany({ where: { interactionId, saleEmail: actor.email } });
    if (count === 0) return false;
    await logAction(tx, actor, SYSTEM_LOG_ACTION.RELEASE_FROM_WORKSPACE, interactionId, { saleEmail: actor.email }, null);
    return true;
  });

  if (!released) {
    throw new ApiError(409, "CONFLICT", "Liên hệ này không còn trong Workspace của bạn.");
  }
}
