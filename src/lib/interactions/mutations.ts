// Port LeadService.gs: createLead_, updateConversationInfo_, updateLeadResult_,
// pushFollowup_, completeFollowup_, reassignLead_ — viết lại cho Prisma/Postgres,
// dùng transaction + kiểm tra Version thay cho LockService.getDocumentLock().
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError, Errors } from "@/lib/interactions/errors";
import {
  CAN_CREATE_OR_EDIT_LEAD,
  CAN_PUSH_FOLLOWUP,
  CAN_REASSIGN,
  FOLLOWUP_OUTCOME,
  IS_LEADER_LIKE,
  ROLES,
  STATUS,
  SPAM_REASON,
  SYSTEM_LOG_ACTION,
  canonicalStatusKey,
  isOpenStatus,
} from "@/lib/interactions/constants";
import { requireRole, requireValidSaleBranchScope, canAccessBranch, isLeaderLike } from "@/lib/interactions/scope";
import { findDuplicateInfo, getCustomerTouch } from "@/lib/interactions/duplicate";
import { resolveLeadInfo } from "@/lib/interactions/lead-info";
import { normalizePhone } from "@/lib/interactions/link";
import { newInteractionId } from "@/lib/interactions/ids";
import { logAction } from "@/lib/interactions/audit";
import { getMaxFollowupBeforeSpam, getSpamNoReplyMinAttempts } from "@/lib/interactions/settings";
import { detailInclude, toDetail } from "@/lib/interactions/serialize";
import type { CurrentUser } from "@/lib/auth/dal";
import type { LeadInfoInput, StatusUpdateInput } from "@/lib/interactions/validation";
import { getInteractionDetail } from "@/lib/interactions/queries";

async function loadInteractionOr404(interactionId: string) {
  const row = await prisma.interaction.findUnique({ where: { interactionId } });
  if (!row) throw Errors.notFound();
  return row;
}

// ---------------------------------------------------------------------------
// Tạo Interaction mới
// ---------------------------------------------------------------------------
export async function createInteraction(actor: CurrentUser, input: LeadInfoInput) {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const info = await resolveLeadInfo(actor, input);
  const dup = await findDuplicateInfo(actor, info.canonicalLink, info.adId, info.fanpageName);

  if (dup.requiresConfirmation && !info.duplicateConfirmed) {
    throw Errors.duplicateConfirmRequired(dup);
  }
  if (dup.requiresConfirmation && !info.duplicateReason) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập lý do xác nhận đây là một lượt hội thoại mới thực tế.");
  }

  const { makeCustomerKey } = await import("@/lib/interactions/ids");
  const customerKey = dup.existingCustomerKey || makeCustomerKey("url:" + info.canonicalLink);
  const touch = await getCustomerTouch(customerKey, info.adId);
  const interactionType = dup.requiresConfirmation ? dup.confirmedClassification : dup.classification;

  const now = new Date();
  const interactionId = newInteractionId();

  const detail = await prisma.$transaction(async (tx) => {
    await tx.customer.upsert({
      where: { customerKey },
      update: { displayName: info.customerName, lastTouchAt: now, currentStatusName: STATUS.WAITING },
      create: {
        customerKey,
        displayName: info.customerName,
        canonicalLink: info.canonicalLink,
        firstTouchAt: now,
        lastTouchAt: now,
        currentStatusName: STATUS.WAITING,
      },
    });

    await tx.interaction.create({
      data: {
        interactionId,
        customerKey,
        version: 1,
        activeFlag: true,
        createdLeadAt: now,
        sourceName: info.sourceName,
        fanpageName: info.fanpageName,
        adId: info.adId || null,
        firstTouchAdId: touch.firstTouchAdId,
        lastTouchAdId: touch.lastTouchAdId,
        rawLink: info.rawLink,
        canonicalLink: info.canonicalLink,
        customerName: info.customerName,
        customerObjectName: info.customerObjectName,
        suggestedBranchCode: info.suggestedBranchCode,
        assignedBranchCode: info.assignedBranchCode,
        statusName: STATUS.WAITING,
        interactionType,
        touchCount: touch.sequence,
        createdByEmail: actor.email,
        createdAt: now,
        updatedByEmail: actor.email,
        updatedAt: now,
        needsFollowup: false,
        conversationLink: info.conversationLink || null,
      },
    });

    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.CREATE_CONVERSATION,
      interactionId,
      null,
      { interactionType, canonicalLink: info.canonicalLink },
      "SUCCESS",
      dup.requiresConfirmation ? "confirmed-return-interaction: " + info.duplicateReason : undefined
    );

    return getInteractionDetail(actor, interactionId, tx);
  });

  return { lead: detail, duplicate: dup };
}

// ---------------------------------------------------------------------------
// Sửa thông tin hội thoại (chỉ khi còn mở — Chờ/Tiếp nhận)
// ---------------------------------------------------------------------------
export async function updateInteractionInfo(actor: CurrentUser, interactionId: string, input: LeadInfoInput & { expectedVersion: number }) {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const lead = await loadInteractionOr404(interactionId);
  const canEdit = isLeaderLike(actor) || (actor.role === ROLES.SALES && canAccessBranch(actor, lead.assignedBranchCode) && isOpenStatus(lead.statusName));
  if (!canEdit) throw Errors.forbidden("Bạn không được sửa thông tin của hội thoại này.");
  if (lead.version !== input.expectedVersion) throw Errors.staleVersion();

  const info = await resolveLeadInfo(actor, input);
  const dup = await findDuplicateInfo(actor, info.canonicalLink, info.adId, info.fanpageName, interactionId);
  if (dup.requiresConfirmation && !info.duplicateConfirmed) throw Errors.duplicateConfirmRequired(dup);
  if (dup.requiresConfirmation && !info.duplicateReason) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập lý do xác nhận hội thoại đang sửa là một lượt tương tác thực.");
  }

  const { makeCustomerKey } = await import("@/lib/interactions/ids");
  const customerKey = dup.existingCustomerKey || makeCustomerKey("url:" + info.canonicalLink);
  const touch = await getCustomerTouch(customerKey, info.adId);
  const interactionType = dup.requiresConfirmation ? dup.confirmedClassification : dup.classification;
  const now = new Date();

  const detail = await prisma.$transaction(async (tx) => {
    await tx.customer.upsert({
      where: { customerKey },
      update: { displayName: info.customerName, lastTouchAt: now },
      create: {
        customerKey,
        displayName: info.customerName,
        canonicalLink: info.canonicalLink,
        firstTouchAt: now,
        lastTouchAt: now,
        currentStatusName: lead.statusName,
      },
    });

    const result = await tx.interaction.updateMany({
      where: { interactionId, version: input.expectedVersion },
      data: {
        version: { increment: 1 },
        customerKey,
        sourceName: info.sourceName,
        fanpageName: info.fanpageName,
        adId: info.adId || null,
        rawLink: info.rawLink,
        canonicalLink: info.canonicalLink,
        conversationLink: info.conversationLink || null,
        customerName: info.customerName,
        customerObjectName: info.customerObjectName,
        suggestedBranchCode: info.suggestedBranchCode,
        assignedBranchCode: info.assignedBranchCode,
        interactionType,
        touchCount: touch.sequence,
        firstTouchAdId: touch.firstTouchAdId,
        lastTouchAdId: touch.lastTouchAdId,
        updatedByEmail: actor.email,
        updatedAt: now,
      },
    });
    if (result.count === 0) throw Errors.staleVersion();

    await logAction(tx, actor, SYSTEM_LOG_ACTION.UPDATE_CONVERSATION_INFO, interactionId, { customerName: lead.customerName }, { customerName: info.customerName });

    return getInteractionDetail(actor, interactionId, tx);
  });

  return detail;
}

// ---------------------------------------------------------------------------
// Ghi 1 lần chăm sóc (không đổi trạng thái) — dùng làm bằng chứng cho quy
// tắc "đủ 3 lần chăm sóc ở 3 thời điểm riêng biệt" khi đóng Spam vì im lặng.
// ---------------------------------------------------------------------------
export async function recordTouch(actor: CurrentUser, interactionId: string, note?: string) {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  const lead = await loadInteractionOr404(interactionId);
  if (!canAccessBranch(actor, lead.assignedBranchCode) && !isLeaderLike(actor)) throw Errors.forbidden();
  if (!isOpenStatus(lead.statusName)) throw Errors.forbidden("Hội thoại đã đóng, không ghi nhận thêm lượt chăm sóc.");

  await prisma.$transaction(async (tx) => {
    await logAction(tx, actor, SYSTEM_LOG_ACTION.TOUCH, interactionId, null, { note: note || null });
    await tx.interaction.update({
      where: { interactionId },
      data: { updatedByEmail: actor.email, updatedAt: new Date() },
    });
  });

  return getInteractionDetail(actor, interactionId);
}

/**
 * Đếm số NGÀY riêng biệt đã ghi nhận lượt chăm sóc (TOUCH log) — chặn việc
 * nhắn 3 tin liên tiếp trong cùng một lần trò chuyện rồi tính thành 3 lần.
 */
async function countDistinctTouchDays(interactionId: string): Promise<number> {
  const logs = await prisma.systemLog.findMany({
    where: { interactionId, action: SYSTEM_LOG_ACTION.TOUCH },
    select: { loggedAt: true },
  });
  const days = new Set(logs.map((l) => l.loggedAt.toISOString().slice(0, 10)));
  return days.size;
}

// ---------------------------------------------------------------------------
// Chuyển trạng thái — hàm lõi của toàn bộ workflow.
// status không bao giờ nhận "Chờ" (chỉ hệ thống gán lúc tạo). Sale chỉ được
// thao tác khi hội thoại đang mở (Chờ/Tiếp nhận); Leader/Admin có thể sửa cả
// hội thoại đã đóng (mở lại) nhưng bắt buộc có `note` lý do.
// ---------------------------------------------------------------------------
export async function updateStatus(actor: CurrentUser, interactionId: string, input: StatusUpdateInput) {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const lead = await loadInteractionOr404(interactionId);
  if (!canAccessBranch(actor, lead.assignedBranchCode) && !isLeaderLike(actor)) throw Errors.forbidden("Bạn không được cập nhật kết quả của hội thoại này.");

  const beforeKey = canonicalStatusKey(lead.statusName);
  const afterKey = canonicalStatusKey(input.status);
  const saleCanTouch = beforeKey === "WAITING" || beforeKey === "PROCESSING";
  if (!isLeaderLike(actor) && actor.role === ROLES.SALES && !saleCanTouch) {
    throw Errors.forbidden("Hội thoại đã đóng. Sale chỉ được xem; hãy báo Leader/Quản trị nếu cần hiệu chỉnh.");
  }
  const requiresReason = beforeKey === "PHONE" || beforeKey === "SPAM";
  if (requiresReason && !input.note) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập lý do hiệu chỉnh khi xử lý hội thoại đã đóng.");
  }
  if (lead.version !== input.expectedVersion) throw Errors.staleVersion();

  let phoneNorm = "";
  if (afterKey === "PHONE") {
    phoneNorm = normalizePhone(input.phoneRaw ?? lead.phoneRaw ?? "");
    if (!phoneNorm) throw new ApiError(422, "VALIDATION_ERROR", "Đủ tiêu chuẩn bắt buộc có SĐT Việt Nam hợp lệ 10 chữ số.");
  }

  if (afterKey === "SPAM") {
    if (!input.spamReason) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng chọn lý do Spam.");
    if (input.spamReason === SPAM_REASON.NO_REPLY) {
      if (!input.confirmedMinAttempts) {
        const min = await getSpamNoReplyMinAttempts();
        throw new ApiError(422, "VALIDATION_ERROR", `Nếu khách chỉ im lặng, vui lòng xác nhận đã chăm sóc đủ ${min} lần riêng biệt.`);
      }
      const min = await getSpamNoReplyMinAttempts();
      const distinctDays = await countDistinctTouchDays(interactionId);
      if (distinctDays < min) {
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          `Hệ thống mới ghi nhận ${distinctDays}/${min} lượt chăm sóc ở các thời điểm riêng biệt cho hội thoại này. Hãy dùng nút "Ghi nhận đã chăm sóc" ở mỗi lần liên hệ trước khi đóng Spam vì im lặng.`
        );
      }
    }
  }

  const now = new Date();
  const businessChanged = beforeKey !== afterKey;

  const detail = await prisma.$transaction(async (tx) => {
    // Unchecked (không phải Checked) vì statusName backing quan hệ Status —
    // updateMany không cho set field FK-quan-hệ qua input Checked thông thường.
    const data: Prisma.InteractionUncheckedUpdateManyInput = {
      version: { increment: 1 },
      statusName: input.status,
      updatedByEmail: actor.email,
      updatedAt: now,
    };

    if (afterKey === "WAITING" || afterKey === "PROCESSING") {
      if (beforeKey === "PHONE" || beforeKey === "SPAM") {
        Object.assign(data, {
          closedAt: null,
          phoneRaw: null,
          phoneNormalized: null,
          phoneCapturedAt: null,
          assignedSaleEmail: null,
          receivedAt: null,
        });
      }
    }

    if (afterKey === "PHONE") {
      Object.assign(data, { phoneRaw: input.phoneRaw ?? lead.phoneRaw, phoneNormalized: phoneNorm });
      if (beforeKey !== "PHONE") {
        Object.assign(data, {
          phoneCapturedAt: now,
          closedAt: now,
          assignedSaleEmail: actor.email,
          receivedAt: now,
        });
      }
    }

    if (afterKey === "SPAM" && beforeKey !== "SPAM") {
      Object.assign(data, {
        closedAt: now,
        phoneRaw: null,
        phoneNormalized: null,
        phoneCapturedAt: null,
        assignedSaleEmail: null,
        receivedAt: null,
      });
    }

    if (lead.needsFollowup && businessChanged) {
      Object.assign(data, {
        needsFollowup: false,
        followupHandledByEmail: actor.email,
        followupHandledAt: now,
        followupOutcome: FOLLOWUP_OUTCOME.STATUS_CHANGED,
      });
    }

    const result = await tx.interaction.updateMany({ where: { interactionId, version: input.expectedVersion }, data });
    if (result.count === 0) throw Errors.staleVersion();

    if (afterKey === "PHONE" || afterKey === "SPAM") {
      await tx.customer.update({ where: { customerKey: lead.customerKey }, data: { currentStatusName: input.status, lastTouchAt: now, ...(phoneNorm ? { phoneNormalized: phoneNorm } : {}) } });
    } else {
      await tx.customer.update({ where: { customerKey: lead.customerKey }, data: { currentStatusName: input.status, lastTouchAt: now } });
    }

    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.UPDATE_RESULT,
      interactionId,
      { status: lead.statusName },
      { status: input.status, spamReason: input.spamReason ?? null },
      "SUCCESS",
      input.note
    );

    return getInteractionDetail(actor, interactionId, tx);
  });

  return detail;
}

// ---------------------------------------------------------------------------
// Marketing gắn nhãn "Cần chăm sóc lại" hàng loạt (tối đa 50).
// ---------------------------------------------------------------------------
export async function pushFollowup(actor: CurrentUser, interactionIds: string[], suggestion?: string) {
  requireRole(actor, CAN_PUSH_FOLLOWUP);

  let pushed = 0;
  let skipped = 0;
  const now = new Date();

  for (const interactionId of interactionIds) {
    const lead = await prisma.interaction.findUnique({ where: { interactionId } });
    if (!lead || !canAccessBranch(actor, lead.assignedBranchCode)) {
      skipped++;
      continue;
    }
    const key = canonicalStatusKey(lead.statusName);
    if ((key !== "WAITING" && key !== "PROCESSING") || lead.needsFollowup) {
      skipped++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.interaction.update({
        where: { interactionId },
        data: {
          version: { increment: 1 },
          needsFollowup: true,
          mktPushedAt: now,
          mktPushedByEmail: actor.email,
          mktSuggestion: suggestion || null,
          followupHandledByEmail: null,
          followupHandledAt: null,
          followupOutcome: null,
        },
      });
      await logAction(tx, actor, SYSTEM_LOG_ACTION.MKT_PUSH, interactionId, { status: lead.statusName }, { pushedBy: actor.email, suggestion: suggestion || null });
    });
    pushed++;
  }

  return { pushed, skipped };
}

// ---------------------------------------------------------------------------
// Sale đánh dấu đã xử lý xong yêu cầu chăm sóc lại của Marketing.
// ---------------------------------------------------------------------------
export async function resolveFollowup(actor: CurrentUser, interactionId: string) {
  requireRole(actor, CAN_CREATE_OR_EDIT_LEAD);
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const lead = await loadInteractionOr404(interactionId);
  if (!canAccessBranch(actor, lead.assignedBranchCode)) throw Errors.forbidden("Bạn không được xử lý yêu cầu chăm sóc lại của cơ sở này.");
  if (!lead.needsFollowup) {
    throw new ApiError(409, "DATA_CHANGED", "Yêu cầu chăm sóc lại này đã được xử lý hoặc không còn hiệu lực. Hãy tải lại danh sách.");
  }

  const now = new Date();
  const resolvedCount = lead.followupResolvedCount + 1;
  const maxBeforeSpam = await getMaxFollowupBeforeSpam();
  // Đóng thủ công (bấm "Đánh dấu đã xử lý") mà vẫn còn mở sau đủ số lần cấu
  // hình -> lead đang bị nhắc đi nhắc lại không tiến triển, tự động đóng Spam
  // thay vì để treo vô hạn. Không áp dụng nếu lead đã rời trạng thái mở (an
  // toàn phòng hờ — về lý thuyết needsFollowup chỉ true khi đang Chờ/Tiếp nhận).
  const shouldAutoSpam = resolvedCount >= maxBeforeSpam && isOpenStatus(lead.statusName);

  return prisma.$transaction(async (tx) => {
    const data: Prisma.InteractionUncheckedUpdateInput = {
      version: { increment: 1 },
      needsFollowup: false,
      followupHandledByEmail: actor.email,
      followupHandledAt: now,
      followupOutcome: FOLLOWUP_OUTCOME.MANUAL_DISMISS,
      followupResolvedCount: resolvedCount,
    };

    if (shouldAutoSpam) {
      Object.assign(data, {
        statusName: STATUS.SPAM,
        closedAt: now,
        phoneRaw: null,
        phoneNormalized: null,
        phoneCapturedAt: null,
        assignedSaleEmail: null,
        receivedAt: null,
        updatedByEmail: actor.email,
        updatedAt: now,
      });
    }

    await tx.interaction.update({ where: { interactionId }, data });

    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.MKT_PUSH_RESOLVED,
      interactionId,
      { pushedAt: lead.mktPushedAt },
      { resolvedAt: now, resolvedByEmail: actor.email, resolvedCount }
    );

    if (shouldAutoSpam) {
      await tx.customer.update({ where: { customerKey: lead.customerKey }, data: { currentStatusName: STATUS.SPAM, lastTouchAt: now } });
      await logAction(
        tx,
        actor,
        SYSTEM_LOG_ACTION.UPDATE_RESULT,
        interactionId,
        { status: lead.statusName },
        { status: STATUS.SPAM, spamReason: SPAM_REASON.MAX_FOLLOWUP_EXCEEDED, autoTriggered: true, resolvedCount },
        "SUCCESS",
        `Tự động chuyển Spam: đã "Đánh dấu đã xử lý" chăm sóc lại ${resolvedCount}/${maxBeforeSpam} lần theo cấu hình hệ thống.`
      );
    }

    return getInteractionDetail(actor, interactionId, tx);
  });
}

// ---------------------------------------------------------------------------
// Leader/Admin điều chuyển người phụ trách — chỉ áp dụng lead đã Đủ tiêu chuẩn.
// ---------------------------------------------------------------------------
export async function reassignInteraction(actor: CurrentUser, interactionId: string, targetEmail: string, reason: string, expectedVersion: number) {
  requireRole(actor, CAN_REASSIGN);

  const target = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!target || !target.active || ![ROLES.SALES, ROLES.LEADER, ROLES.ADMIN].includes(target.role as never)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Người phụ trách mới chưa hoạt động hoặc không có vai trò phù hợp.");
  }

  const lead = await loadInteractionOr404(interactionId);
  if (canonicalStatusKey(lead.statusName) !== "PHONE") {
    throw new ApiError(422, "VALIDATION_ERROR", "Chỉ điều chỉnh người phụ trách sau khi lead đã đủ tiêu chuẩn và có SĐT.");
  }
  if (lead.version !== expectedVersion) throw Errors.staleVersion();

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const result = await tx.interaction.updateMany({
      where: { interactionId, version: expectedVersion },
      data: {
        version: { increment: 1 },
        assignedSaleEmail: targetEmail,
        receivedAt: now,
        reassignedByEmail: actor.email,
        reassignReason: reason,
        updatedByEmail: actor.email,
        updatedAt: now,
      },
    });
    if (result.count === 0) throw Errors.staleVersion();
    await logAction(tx, actor, SYSTEM_LOG_ACTION.REASSIGN_PHONE_LEAD, interactionId, { assignedSaleEmail: lead.assignedSaleEmail }, { assignedSaleEmail: targetEmail }, "SUCCESS", reason);
    return getInteractionDetail(actor, interactionId, tx);
  });
}

export { detailInclude, toDetail };
