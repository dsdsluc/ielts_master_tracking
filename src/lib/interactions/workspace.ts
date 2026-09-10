import "server-only";
import { prisma } from "@/lib/prisma";
import { CAN_CREATE_OR_EDIT_LEAD, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { canAccessBranch, requireRole } from "@/lib/interactions/scope";
import { logAction } from "@/lib/interactions/audit";
import { ApiError, Errors } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

const OPEN_STATUSES: string[] = [STATUS.WAITING, STATUS.PROCESSING];

async function claimOne(actor: CurrentUser, interactionId: string): Promise<void> {
  const lead = await prisma.interaction.findUnique({
    where: { interactionId },
    select: { assignedBranchCode: true, activeFlag: true },
  });
  if (!lead || !lead.activeFlag) throw Errors.notFound();
  if (!canAccessBranch(actor, lead.assignedBranchCode)) {
    throw Errors.forbidden("Bạn không được thao tác trên liên hệ này.");
  }

  const claimed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.interaction.updateMany({
      where: {
        interactionId,
        activeFlag: true,
        statusName: { in: OPEN_STATUSES },
        workspaceClaimedByEmail: null,
      },
      data: { workspaceClaimedByEmail: actor.email },
    });
    if (count === 0) return false;
    await logAction(tx, actor, SYSTEM_LOG_ACTION.ADD_TO_WORKSPACE, interactionId, null, { workspaceClaimedByEmail: actor.email });
    return true;
  });

  if (!claimed) {
    throw new ApiError(409, "CONFLICT", "Liên hệ này đã được Sale khác thêm vào Workspace hoặc không còn khả dụng.");
  }
}

export async function claimForWorkspace(actor: CurrentUser, interactionId: string): Promise<void> {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  await claimOne(actor, interactionId);
}

/** Xử lý tuần tự — mỗi liên hệ tự chịu trách nhiệm thành công/thất bại riêng,
 * 1 dòng bị Sale khác giành mất trước không được làm hỏng cả lô. */
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

export async function releaseFromWorkspace(actor: CurrentUser, interactionId: string): Promise<void> {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);

  const released = await prisma.$transaction(async (tx) => {
    const { count } = await tx.interaction.updateMany({
      where: { interactionId, workspaceClaimedByEmail: actor.email },
      data: { workspaceClaimedByEmail: null },
    });
    if (count === 0) return false;
    await logAction(tx, actor, SYSTEM_LOG_ACTION.RELEASE_FROM_WORKSPACE, interactionId, { workspaceClaimedByEmail: actor.email }, null);
    return true;
  });

  if (!released) {
    throw new ApiError(409, "CONFLICT", "Liên hệ này không còn trong Workspace của bạn.");
  }
}
