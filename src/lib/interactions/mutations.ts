// Port LeadService.gs: createLead_, updateConversationInfo_, updateLeadResult_,
// pushFollowup_, completeFollowup_, reassignLead_ — viết lại cho Prisma/Postgres,
// dùng transaction + kiểm tra Version thay cho LockService.getDocumentLock().
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError, Errors } from "@/lib/interactions/errors";
import {
  CUSTOMER_STAGE,
  FOLLOWUP_OUTCOME,
  INTERACTION_ACTIVITY,
  ROLES,
  STATUS,
  SYSTEM_LOG_ACTION,
  SPAM_REASON_MIN_LENGTH,
  canonicalStatusKey,
  isOpenStatus,
  isValidSpamReason,
} from "@/lib/interactions/constants";
import { requireValidSaleBranchScope, canAccessBranch, isLeaderLike } from "@/lib/interactions/scope";
import { findDuplicateInfo, findCustomerKeyByPhone, getCustomerTouch } from "@/lib/interactions/duplicate";
import { resolveLeadInfo, resolveExternalLeadInfo, type ResolvedLeadInfo } from "@/lib/interactions/lead-info";
import { normalizePhone } from "@/lib/interactions/link";
import { newInteractionId, makeCustomerKey } from "@/lib/interactions/ids";
import { logAction, logInteractionActivity } from "@/lib/interactions/audit";
import { detailInclude, toDetail } from "@/lib/interactions/serialize";
import { appLink, sendEmail, emailEnvelope } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";
import { spamReasonLabel } from "@/app/(app)/admin/spam-reason";
import type { CurrentUser } from "@/lib/auth/dal";
import type { CreateLeadInput, LeadInfoInput, StatusUpdateInput } from "@/lib/interactions/validation";
import { getInteractionDetail } from "@/lib/interactions/queries";
import { getMaxFollowupBeforeSpam } from "@/lib/interactions/settings";

// ---------------------------------------------------------------------------
// Thông báo chủ động qua email khi liên hệ đổi trạng thái (bổ sung cho
// updateStatus() bên dưới) — cùng nguyên tắc với assignFollowup(): gửi mail
// SAU khi transaction DB đã xong (I/O không nằm trong transaction), sendEmail()
// tự nuốt lỗi nên không ảnh hưởng kết quả cập nhật trạng thái.
// ---------------------------------------------------------------------------

// Liên hệ lần đầu Đủ tiêu chuẩn (Customer vừa được tạo) — báo Leader/Admin
// vào phân bổ tư vấn ngay, thay vì phải tự nhớ ghé /customer-assignment kiểm tra.
async function notifyLeadersNewQualifiedLead(interactionId: string, customerName: string, customerKey: string) {
  const recipients = await prisma.user.findMany({
    where: { role: { in: [ROLES.LEADER, ROLES.ADMIN] }, active: true },
    select: { email: true, fullName: true },
  });
  if (recipients.length === 0) return;

  const [first, ...rest] = recipients;
  const link = appLink(`/customers/${customerKey}`);
  const safeName = escapeHtml(customerName);
  await sendEmail({
    to: first.email,
    toName: first.fullName,
    bcc: rest.map((r) => r.email),
    subject: `Liên hệ mới Đủ tiêu chuẩn: ${customerName}`,
    html: emailEnvelope({
      audienceNote: `Gửi tới toàn bộ Leader/Admin đang hoạt động (${recipients.length} người).`,
      purpose: "Có 1 liên hệ vừa Đủ tiêu chuẩn (đã xin được SĐT) và đang chờ được phân bổ cho Sale tư vấn.",
      bodyHtml: `<p>Liên hệ <strong>${safeName}</strong> vừa Đủ tiêu chuẩn.</p><p><strong>Việc cần làm:</strong> ${
        link ? `<a href="${link}">Xem khách hàng</a> rồi` : ""
      } vào mục Phân bổ khách hàng để giao cho 1 Sale phụ trách.</p>`,
      senderLabel: "Hệ thống tự động",
    }),
    action: SYSTEM_LOG_ACTION.NOTIFY_NEW_QUALIFIED_LEAD,
    sentByEmail: null,
    interactionIds: [interactionId],
  });
}

// Đóng Spam 1 liên hệ đang có yêu cầu "Cần chăm sóc lại" còn mở — báo lại
// đúng người Marketing đã gửi yêu cầu đó, thay vì họ phải tự vào lại từng
// liên hệ mới biết kết quả.
async function notifyMarketingLeadSpammed(
  actor: CurrentUser,
  interactionId: string,
  customerName: string,
  mktPushedByEmail: string,
  spamReasonCode: string | null
) {
  const recipient = await prisma.user.findUnique({ where: { email: mktPushedByEmail }, select: { fullName: true } });
  const link = appLink(`/leads/${interactionId}`);
  const safeName = escapeHtml(customerName);
  const reasonLabel = escapeHtml(spamReasonLabel(spamReasonCode));
  await sendEmail({
    to: mktPushedByEmail,
    toName: recipient?.fullName,
    subject: `Liên hệ đã chuyển Spam: ${customerName}`,
    html: emailEnvelope({
      greetingName: recipient?.fullName,
      purpose: `Liên hệ bạn từng gửi yêu cầu "Cần chăm sóc lại" vừa bị đánh dấu Spam — không cần theo dõi tiếp nữa.`,
      bodyHtml: `<p>Liên hệ <strong>${safeName}</strong> đã chuyển Spam${reasonLabel ? ` (lý do: ${reasonLabel})` : ""}.</p><p>${
        link ? `<a href="${link}">Xem chi tiết</a>` : ""
      }</p>`,
      senderLabel: `${actor.fullName} (đánh dấu Spam)`,
    }),
    action: SYSTEM_LOG_ACTION.NOTIFY_LEAD_SPAMMED,
    sentByEmail: actor.email,
    interactionIds: [interactionId],
  });
}

/** Đếm riêng số lần Sale tạo liên hệ + số lần tạo ra đã Đủ điều kiện ngay lúc
 * tạo — bảng riêng (SaleLeadStat), không tính lại bằng query Interaction. */
async function bumpSaleLeadStat(tx: Prisma.TransactionClient, saleEmail: string, qualified: boolean): Promise<void> {
  await tx.saleLeadStat.upsert({
    where: { saleEmail },
    update: { totalCreated: { increment: 1 }, ...(qualified ? { totalQualified: { increment: 1 } } : {}) },
    create: { saleEmail, totalCreated: 1, totalQualified: qualified ? 1 : 0 },
  });
}

/** Nhãn tiếng Việt của từng field được theo dõi thay đổi — denormalized vào
 * InteractionFieldLog.fieldLabel tại thời điểm ghi (xem comment model trong
 * schema.prisma), nên map này chỉ cần đúng tại THỜI ĐIỂM ghi log, đổi sau
 * không ảnh hưởng log cũ. */
const FIELD_LABELS: Record<string, string> = {
  rawLink: "Link khách hàng",
  customerName: "Tên khách hàng",
  fanpageName: "Fanpage",
  conversationLink: "Link hội thoại",
  adId: "Ad ID",
  customerObjectName: "Đối tượng",
  assignedBranchCode: "Cơ sở phụ trách",
};

/** "" / null / undefined đều coi là "trống" khi so sánh — adId/conversationLink
 * của ResolvedLeadInfo luôn là "" khi trống (không phải null) trong khi cột
 * DB tương ứng là null, nên phải chuẩn hoá 2 phía về cùng 1 dạng trước khi so. */
function normalizeEmpty(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? null : value;
}

/**
 * Chỉ ghi log cho field nào TRƯỚC ĐÓ đã có giá trị (không trống) và giá trị
 * mới khác giá trị cũ — điền lần đầu vào field đang trống không tính là "thay
 * đổi" nên không ghi (xem comment model InteractionFieldLog trong schema.prisma).
 */
function buildFieldChangeLogs(
  lead: { rawLink: string; customerName: string; fanpageName: string; conversationLink: string | null; adId: string | null; customerObjectName: string; assignedBranchCode: string },
  info: ResolvedLeadInfo
): { fieldKey: string; fieldLabel: string; oldValue: string | null; newValue: string | null }[] {
  const pairs: { fieldKey: keyof typeof FIELD_LABELS; oldValue: string | null; newValue: string | null }[] = [
    { fieldKey: "rawLink", oldValue: normalizeEmpty(lead.rawLink), newValue: normalizeEmpty(info.rawLink) },
    { fieldKey: "customerName", oldValue: normalizeEmpty(lead.customerName), newValue: normalizeEmpty(info.customerName) },
    { fieldKey: "fanpageName", oldValue: normalizeEmpty(lead.fanpageName), newValue: normalizeEmpty(info.fanpageName) },
    { fieldKey: "conversationLink", oldValue: normalizeEmpty(lead.conversationLink), newValue: normalizeEmpty(info.conversationLink) },
    { fieldKey: "adId", oldValue: normalizeEmpty(lead.adId), newValue: normalizeEmpty(info.adId) },
    { fieldKey: "customerObjectName", oldValue: normalizeEmpty(lead.customerObjectName), newValue: normalizeEmpty(info.customerObjectName) },
    { fieldKey: "assignedBranchCode", oldValue: normalizeEmpty(lead.assignedBranchCode), newValue: normalizeEmpty(info.assignedBranchCode) },
  ];

  return pairs
    .filter((p) => p.oldValue !== null && p.oldValue !== p.newValue)
    .map((p) => ({ fieldKey: p.fieldKey, fieldLabel: FIELD_LABELS[p.fieldKey], oldValue: p.oldValue, newValue: p.newValue }));
}

async function loadInteractionOr404(interactionId: string) {
  const row = await prisma.interaction.findUnique({ where: { interactionId } });
  if (!row) throw Errors.notFound();
  return row;
}

// ---------------------------------------------------------------------------
// Tạo Interaction mới
// ---------------------------------------------------------------------------
export async function createInteraction(actor: CurrentUser, input: CreateLeadInput) {
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const info = input.channel === "external" ? await resolveExternalLeadInfo(actor, input) : await resolveLeadInfo(actor, input);
  const dup = await findDuplicateInfo(actor, info.canonicalLink, info.adId, info.fanpageName);

  if (dup.requiresConfirmation && !info.duplicateConfirmed) {
    throw Errors.duplicateConfirmRequired(dup);
  }
  if (dup.requiresConfirmation && !info.duplicateReason) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập lý do xác nhận đây là một lượt hội thoại mới thực tế.");
  }

  const touch = await getCustomerTouch(info.canonicalLink, info.adId);
  const interactionType = dup.requiresConfirmation ? dup.confirmedClassification : dup.classification;

  // Tab Facebook: SĐT tùy chọn — có thì tạo thẳng "Đủ tiêu chuẩn" thay vì
  // "Chờ" (mirror field set của updateStatus() khi chuyển WAITING/PROCESSING
  // -> PHONE lần đầu). Tab Ngoài: SĐT luôn bắt buộc (đã validate ở
  // resolveExternalLeadInfo) nên luôn "Đủ tiêu chuẩn" ngay từ đầu.
  const phoneNorm = input.phoneRaw ? normalizePhone(input.phoneRaw) : "";
  if (input.phoneRaw && !phoneNorm) {
    throw new ApiError(422, "VALIDATION_ERROR", "SĐT không hợp lệ — cần đúng định dạng số Việt Nam 10 chữ số.");
  }
  const qualified = !!phoneNorm;
  // "Có nhu cầu" (STATUS.PROCESSING) KHÔNG được tự suy ra từ việc có sẵn link
  // cuộc hội thoại — có link chỉ là bằng chứng để đối chiếu, không đồng nghĩa
  // Sale đã thật sự nhắn tin qua lại. Trạng thái này chỉ do Sale CHỦ ĐỘNG gán
  // sau khi đã liên hệ (xem "Ghi nhận đã liên hệ" ở use-interaction-detail.ts
  // và resolveFollowup() bên dưới) — lúc TẠO MỚI luôn chỉ có 2 khả năng.
  const initialStatus = qualified ? STATUS.PHONE : STATUS.WAITING;

  // Chỉ sinh + ghi customerKey khi Đủ tiêu chuẩn — liên hệ "Chờ"/"Có nhu cầu"
  // chưa có Customer tương ứng (xem comment customerKey trong schema.prisma).
  // Ưu tiên GHÉP vào Customer đã có cùng SĐT (findCustomerKeyByPhone) trước
  // khi sinh customerKey mới theo link — tránh tạo 2 hồ sơ cho cùng 1 người
  // khi nhập hàng loạt từ nhiều nguồn/link khác nhau cho cùng 1 SĐT (xem
  // comment ở duplicate.ts).
  const customerKey = qualified
    ? dup.existingCustomerKey || (await findCustomerKeyByPhone(phoneNorm)) || makeCustomerKey("url:" + info.canonicalLink)
    : null;

  // Mốc tư vấn kèm theo (nhập Excel dữ liệu tư vấn cũ, xem leads-import-view.tsx)
  // — chỉ áp dụng lúc TẠO MỚI hồ sơ Customer (nhánh create bên dưới), không
  // bao giờ ghi đè mốc của 1 Customer đã tồn tại — 1 dòng Excel cũ/thiếu
  // thông tin không được phép làm lùi tiến trình tư vấn thật đang có. "Không
  // quan tâm" bắt buộc kèm lý do y hệt updateCustomerStage(); thiếu lý do thì
  // bỏ qua mốc này (không chặn cả dòng) — Sale phụ trách điền lại sau.
  const rawStage = input.channel === "facebook" ? (input.stage ?? "").trim() : "";
  const rawStageReason = input.channel === "facebook" ? (input.stageReason ?? "").trim() : "";
  const isValidStageValue = (Object.values(CUSTOMER_STAGE) as string[]).includes(rawStage);
  const stageToApply = isValidStageValue && (rawStage !== CUSTOMER_STAGE.NOT_INTERESTED || rawStageReason) ? rawStage : null;

  const now = new Date();
  const interactionId = newInteractionId();

  const detail = await prisma.$transaction(async (tx) => {
    if (customerKey) {
      await tx.customer.upsert({
        where: { customerKey },
        update: { displayName: info.customerName, lastTouchAt: now, currentStatusName: initialStatus, phoneNormalized: phoneNorm },
        create: {
          customerKey,
          displayName: info.customerName,
          canonicalLink: info.canonicalLink,
          firstTouchAt: now,
          lastTouchAt: now,
          currentStatusName: initialStatus,
          phoneNormalized: phoneNorm,
          ...(stageToApply
            ? {
                stage: stageToApply,
                stageReason: rawStageReason || null,
                ...(stageToApply === CUSTOMER_STAGE.ENROLLED ? { enrolledAt: now } : {}),
              }
            : {}),
        },
      });
    }

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
        statusName: initialStatus,
        interactionType,
        assignedSaleEmail: actor.email,
        createdByEmail: actor.email,
        createdAt: now,
        updatedByEmail: actor.email,
        updatedAt: now,
        needsFollowup: false,
        conversationLink: info.conversationLink || null,
        ...(phoneNorm
          ? {
              phoneRaw: input.phoneRaw,
              phoneNormalized: phoneNorm,
              phoneCapturedAt: now,
              closedAt: now,
              receivedAt: now,
            }
          : {}),
      },
    });

    await bumpSaleLeadStat(tx, actor.email, qualified);

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
// Sửa thông tin hội thoại (chỉ khi còn mở — Chờ/Có nhu cầu)
// ---------------------------------------------------------------------------
export async function updateInteractionInfo(actor: CurrentUser, interactionId: string, input: LeadInfoInput & { expectedVersion: number }) {
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

  const touch = await getCustomerTouch(info.canonicalLink, info.adId);
  const interactionType = dup.requiresConfirmation ? dup.confirmedClassification : dup.classification;
  const now = new Date();

  // Sửa thông tin không đổi trạng thái Đủ điều kiện — chỉ đụng tới Customer
  // nếu hội thoại NÀY đã từng đủ điều kiện từ trước (đã có customerKey); nếu
  // chưa (đang Chờ/Có nhu cầu), sửa Link/Tên... cũng không tự tạo Customer.
  const wasQualified = !!lead.customerKey;
  const customerKey = wasQualified ? dup.existingCustomerKey || makeCustomerKey("url:" + info.canonicalLink) : null;

  const detail = await prisma.$transaction(async (tx) => {
    if (customerKey) {
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
    }

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
        firstTouchAdId: touch.firstTouchAdId,
        lastTouchAdId: touch.lastTouchAdId,
        ...(actor.role === ROLES.SALES ? { assignedSaleEmail: actor.email } : {}),
        updatedByEmail: actor.email,
        updatedAt: now,
      },
    });
    if (result.count === 0) throw Errors.staleVersion();

    const fieldChanges = buildFieldChangeLogs(lead, info);
    if (fieldChanges.length > 0) {
      await tx.interactionFieldLog.createMany({
        data: fieldChanges.map((c) => ({
          interactionId,
          fieldKey: c.fieldKey,
          fieldLabel: c.fieldLabel,
          oldValue: c.oldValue,
          newValue: c.newValue,
          changedByEmail: actor.email,
          changedByName: actor.fullName,
        })),
      });
    }

    await logAction(tx, actor, SYSTEM_LOG_ACTION.UPDATE_CONVERSATION_INFO, interactionId, { customerName: lead.customerName }, { customerName: info.customerName });

    return getInteractionDetail(actor, interactionId, tx);
  });

  return detail;
}

// ---------------------------------------------------------------------------
// Chuyển trạng thái — hàm lõi của toàn bộ workflow.
// status không bao giờ nhận "Chờ" (chỉ hệ thống gán lúc tạo). Sale chỉ được
// thao tác khi hội thoại đang mở (Chờ/Có nhu cầu); Leader/Admin có thể sửa cả
// hội thoại đã đóng (mở lại) nhưng bắt buộc có `note` lý do.
// ---------------------------------------------------------------------------
export async function updateStatus(actor: CurrentUser, interactionId: string, input: StatusUpdateInput) {
  // Ngoại lệ hẹp: Marketing được đóng thẳng Spam khi xem lại hội thoại ở
  // trang "Chăm sóc lại" — chỉ áp dụng cho hội thoại đang mở (xem check bên dưới).
  const isMarketingSpam = actor.role === ROLES.MARKETING && input.status === STATUS.SPAM;
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const lead = await loadInteractionOr404(interactionId);
  if (!canAccessBranch(actor, lead.assignedBranchCode) && !isLeaderLike(actor)) throw Errors.forbidden("Bạn không được cập nhật kết quả của hội thoại này.");

  const beforeKey = canonicalStatusKey(lead.statusName);
  const afterKey = canonicalStatusKey(input.status);
  const saleCanTouch = beforeKey === "WAITING" || beforeKey === "PROCESSING";
  if (!isLeaderLike(actor) && actor.role === ROLES.SALES && !saleCanTouch) {
    throw Errors.forbidden("Hội thoại đã đóng. Sale chỉ được xem; hãy báo Leader/Quản trị nếu cần hiệu chỉnh.");
  }
  if (isMarketingSpam && beforeKey !== "WAITING" && beforeKey !== "PROCESSING") {
    throw Errors.forbidden("Chỉ đóng Spam trực tiếp được với hội thoại đang mở.");
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
    if (!isValidSpamReason(input.spamReason)) {
      throw new ApiError(422, "VALIDATION_ERROR", `Vui lòng nhập lý do Spam (trên ${SPAM_REASON_MIN_LENGTH} ký tự).`);
    }
    // Không có link hội thoại thì không ai đối chiếu được đây có thực sự là
    // Spam hay không — chặn ngay ở server (nguồn xác thực duy nhất), UI chỉ
    // disable cho đẹp (xem SpamDialog/followup-view.tsx).
    if (!lead.conversationLink) {
      throw new ApiError(422, "VALIDATION_ERROR", "Liên hệ chưa có link cuộc hội thoại — không thể đánh dấu Spam.");
    }
  }

  const now = new Date();
  const businessChanged = beforeKey !== afterKey;
  // Lần đầu chuyển sang Đủ tiêu chuẩn (chưa từng có customerKey) — sinh
  // customerKey mới (deterministic theo canonicalLink, xem makeCustomerKey())
  // để lúc này mới tạo dòng Customer tương ứng.
  const customerKey = afterKey === "PHONE" ? (lead.customerKey ?? makeCustomerKey("url:" + lead.canonicalLink)) : lead.customerKey;

  const detail = await prisma.$transaction(async (tx) => {
    // Unchecked (không phải Checked) vì statusName backing quan hệ Status —
    // updateMany không cho set field FK-quan-hệ qua input Checked thông thường.
    // KHÔNG gán customerKey mới (customerKey !== lead.customerKey — lần đầu
    // Đủ tiêu chuẩn) vào đây — dòng Customer tương ứng CHƯA tồn tại lúc này,
    // gán ngay sẽ vi phạm khoá ngoại interactions_customer_key_fkey (Postgres
    // kiểm tra FK ngay khi UPDATE chạy xong, không đợi hết transaction). Phải
    // tạo Customer trước (xem dưới), rồi mới gán customerKey ở update riêng.
    const data: Prisma.InteractionUncheckedUpdateManyInput = {
      version: { increment: 1 },
      statusName: input.status,
      updatedByEmail: actor.email,
      updatedAt: now,
      ...(actor.role === ROLES.SALES ? { assignedSaleEmail: actor.email } : {}),
    };

    if (afterKey === "WAITING" || afterKey === "PROCESSING") {
      if (beforeKey === "PHONE" || beforeKey === "SPAM") {
        Object.assign(data, {
          closedAt: null,
          phoneRaw: null,
          phoneNormalized: null,
          phoneCapturedAt: null,
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
        receivedAt: null,
      });
    }

    if (lead.needsFollowup && businessChanged) {
      Object.assign(data, {
        needsFollowup: false,
        followupTargetSaleEmail: null,
        followupHandledByEmail: actor.email,
        followupHandledAt: now,
        followupOutcome: FOLLOWUP_OUTCOME.STATUS_CHANGED,
      });
    }

    const result = await tx.interaction.updateMany({ where: { interactionId, version: input.expectedVersion }, data });
    if (result.count === 0) throw Errors.staleVersion();
    if (afterKey === "PHONE") {
      // Lần đầu đủ điều kiện thì đây là lúc dòng Customer ra đời — trước đó
      // (đang Chờ/Có nhu cầu) chưa từng ghi vào bảng customers.
      await tx.customer.upsert({
        where: { customerKey: customerKey! },
        update: { currentStatusName: input.status, lastTouchAt: now, ...(phoneNorm ? { phoneNormalized: phoneNorm } : {}) },
        create: {
          customerKey: customerKey!,
          displayName: lead.customerName,
          canonicalLink: lead.canonicalLink,
          firstTouchAt: now,
          lastTouchAt: now,
          currentStatusName: input.status,
          phoneNormalized: phoneNorm || null,
        },
      });
      // Customer vừa tồn tại (upsert ở trên) — giờ mới an toàn gán customerKey
      // mới vào Interaction nếu đây là lần đầu (xem comment ở khai báo `data`).
      if (customerKey !== lead.customerKey) {
        await tx.interaction.update({ where: { interactionId }, data: { customerKey } });
      }
    } else if (lead.customerKey) {
      // SPAM/Có nhu cầu: chỉ cập nhật nếu ĐÃ có Customer từ trước (từng đủ
      // tiêu chuẩn) — updateMany thay vì update để không throw khi liên hệ
      // này chưa từng đủ điều kiện (customerKey null, chưa có Customer nào).
      await tx.customer.updateMany({ where: { customerKey: lead.customerKey }, data: { currentStatusName: input.status, lastTouchAt: now } });
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
    // Sale đóng Spam/Đủ tiêu chuẩn ngay trên trang chi tiết chăm sóc lại (thay
    // vì bấm "Đánh dấu đã chăm sóc lại") — tắt cờ needsFollowup ở nhánh trên
    // rồi, ghi thêm 1 dòng vào đúng chỗ getFollowupHistory() đọc để timeline
    // "Lịch sử chăm sóc lại" không bị thiếu mốc kết thúc.
    if (lead.needsFollowup && businessChanged) {
      await logInteractionActivity(tx, actor, interactionId, INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED, {
        oldValue: lead.statusName,
        newValue: input.status,
        note: input.note ?? null,
      });
    }

    return getInteractionDetail(actor, interactionId, tx);
  });

  if (afterKey === "PHONE" && customerKey && customerKey !== lead.customerKey) {
    await notifyLeadersNewQualifiedLead(interactionId, lead.customerName, customerKey);
  }
  if (afterKey === "SPAM" && lead.needsFollowup && businessChanged && lead.mktPushedByEmail) {
    await notifyMarketingLeadSpammed(actor, interactionId, lead.customerName, lead.mktPushedByEmail, input.spamReason ?? null);
  }

  return detail;
}

// ---------------------------------------------------------------------------
// Marketing gắn nhãn "Cần chăm sóc lại" hàng loạt (tối đa 50) — CHỈ gửi yêu
// cầu, KHÔNG chọn Sale. Yêu cầu vào hàng đợi chờ Leader/Admin phân bổ ở
// /followup-assign (xem assignFollowup() bên dưới) — tách trách nhiệm: Marketing
// phát hiện & gửi, Leader quyết định ai xử lý. Liên hệ đã gửi rồi (needsFollowup
// đang true, bất kể đã có Sale nhận hay chưa) không gửi lại được từ đây nữa.
//
// followupResolvedCount tăng +1 NGAY Ở ĐÂY — đếm số lần Marketing từng phải gửi
// yêu cầu chăm sóc lại cho đúng liên hệ này qua suốt vòng đời của nó (không còn
// đếm số lần Sale bấm "đã xử lý" như trước — xem resolveFollowup() bên dưới,
// giờ luôn buộc tiến triển thật nên không còn khái niệm "bấm cho có" để đếm).
//
// Liên hệ đã bị gửi đủ MAX_FOLLOWUP_BEFORE_SPAM lần (mặc định 3, cấu hình ở
// /admin/monitoring) thì KHÔNG gửi thêm lần nữa — tự động chuyển thẳng sang
// Spam (qua updateStatus() để đi đúng 1 luồng đóng Spam duy nhất, giữ nguyên
// mọi ràng buộc/tác dụng phụ của nó, vd bắt buộc có link hội thoại). Tránh
// vòng lặp chăm sóc lại vô thời hạn (4, 5 lần...) mà không có điểm dừng.
// ---------------------------------------------------------------------------
export async function pushFollowup(actor: CurrentUser, interactionIds: string[], suggestion?: string) {
  const maxBeforeSpam = await getMaxFollowupBeforeSpam();
  let pushed = 0;
  let skipped = 0;
  let autoSpammed = 0;
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
    if (lead.followupResolvedCount >= maxBeforeSpam) {
      try {
        await updateStatus(actor, interactionId, {
          status: STATUS.SPAM,
          spamReason: `Đã gửi yêu cầu chăm sóc lại đủ ${maxBeforeSpam} lần, không còn phản hồi.`,
          expectedVersion: lead.version,
        });
        autoSpammed++;
      } catch {
        // Không đóng Spam được (vd thiếu link hội thoại) — bỏ qua, để Marketing
        // tự xử lý thủ công thay vì chặn cả batch vì 1 liên hệ lỗi.
        skipped++;
      }
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
          followupTargetSaleEmail: null,
          followupResolvedCount: { increment: 1 },
        },
      });
      await logInteractionActivity(tx, actor, interactionId, INTERACTION_ACTIVITY.FOLLOWUP_PUSH, { newValue: suggestion || null });
    });
    pushed++;
  }

  return { pushed, skipped, autoSpammed };
}

// ---------------------------------------------------------------------------
// Leader/Admin phân bổ yêu cầu "Cần chăm sóc lại" (Marketing đã gửi, chưa có
// Sale nào nhận) cho 1 Sale cụ thể — Sale đó mới thấy dòng này ở
// /followup-inbox và nhận mail thông báo (dời thời điểm gửi mail từ lúc
// Marketing gửi sang lúc Leader gán, vì trước đó Sale còn chưa biết mình là
// người phụ trách). Hỗ trợ cả gán 1 dòng lẫn hàng loạt (tối đa 50) cho cùng
// 1 Sale — mirror reassignInteractions() ở trên.
// ---------------------------------------------------------------------------
async function applyAssignFollowup(interactionId: string, target: { email: string; fullName: string | null }, actor: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.interaction.findUnique({ where: { interactionId } });
    if (!lead) throw Errors.notFound();
    if (!lead.needsFollowup || lead.followupTargetSaleEmail) {
      throw new ApiError(409, "DATA_CHANGED", "Yêu cầu này đã được phân bổ hoặc không còn hiệu lực.");
    }

    await tx.interaction.update({
      where: { interactionId },
      data: { version: { increment: 1 }, followupTargetSaleEmail: target.email, assignedSaleEmail: target.email },
    });
    await logInteractionActivity(tx, actor, interactionId, INTERACTION_ACTIVITY.FOLLOWUP_ASSIGN, {
      newValue: target.fullName ?? target.email,
    });

    return { customerName: lead.customerName, mktSuggestion: lead.mktSuggestion };
  });
}

export async function assignFollowup(actor: CurrentUser, interactionIds: string[], targetSaleEmail: string): Promise<{ assigned: number; skipped: number }> {
  const target = await validateReassignTarget(targetSaleEmail);

  let assigned = 0;
  let skipped = 0;
  const notifyTargets: { customerName: string; interactionId: string; suggestion: string | null }[] = [];

  for (const interactionId of interactionIds) {
    try {
      const { customerName, mktSuggestion } = await applyAssignFollowup(interactionId, target, actor);
      assigned++;
      notifyTargets.push({ customerName, interactionId, suggestion: mktSuggestion });
    } catch {
      skipped++;
    }
  }

  if (notifyTargets.length > 0) {
    // Gửi mail SAU vòng lặp DB — I/O mạng không nên giữ trong transaction, và
    // lỗi gửi không được làm hỏng việc gán (sendEmail() không throw). Cả batch
    // luôn cùng 1 targetSaleEmail (tham số của hàm) nên gộp thành 1 email duy
    // nhất liệt kê hết các liên hệ, thay vì gửi riêng từng mail — Sale nhận 1
    // thông báo cho 1 lần Leader/Admin phân bổ, dù phân bổ bao nhiêu liên hệ.
    // customerName/suggestion là dữ liệu người dùng nhập (tên khách, gợi ý tự
    // do của Marketing) — escape trước khi chèn vào HTML, vì html này không
    // chỉ gửi qua Gmail mà còn hiển thị lại nguyên trạng trong app (mục "Email
    // đã gửi" ở trang chi tiết liên hệ) qua dangerouslySetInnerHTML.
    const itemsHtml = notifyTargets
      .map((t) => {
        const link = appLink(`/leads/${t.interactionId}`);
        const safeName = escapeHtml(t.customerName);
        const suggestionHtml = t.suggestion ? ` — Gợi ý từ Marketing: ${escapeHtml(t.suggestion)}` : "";
        const label = link ? `<a href="${link}">${safeName}</a>` : safeName;
        return `<li>${label}${suggestionHtml}</li>`;
      })
      .join("");

    // Threading + ghi lịch sử vào email_messages đều xử lý bên trong
    // sendEmail() — chỉ cần khai báo liên hệ nào email này nói tới.
    await sendEmail({
      to: target.email,
      toName: target.fullName,
      subject:
        notifyTargets.length === 1
          ? `Cần chăm sóc lại: ${notifyTargets[0].customerName}`
          : `Cần chăm sóc lại: ${notifyTargets.length} liên hệ`,
      html: emailEnvelope({
        greetingName: target.fullName,
        purpose: `${actor.fullName} vừa phân bổ cho bạn ${notifyTargets.length} liên hệ cần chăm sóc lại.`,
        bodyHtml: `<p><strong>Việc cần làm:</strong> liên hệ lại từng khách dưới đây và cập nhật kết quả:</p><ul>${itemsHtml}</ul>`,
        senderLabel: actor.fullName,
      }),
      action: SYSTEM_LOG_ACTION.FOLLOWUP_ASSIGN,
      sentByEmail: actor.email,
      interactionIds: notifyTargets.map((t) => t.interactionId),
    });
  }

  return { assigned, skipped };
}

// ---------------------------------------------------------------------------
// Sale đánh dấu đã chăm sóc lại xong yêu cầu của Marketing — LUÔN buộc lead
// tiến triển thật: ép statusName về "Có nhu cầu" (kể cả khi đang Có nhu cầu
// sẵn từ trước, followup vẫn có thể được gửi trên lead đang Có nhu cầu), tắt cờ
// needsFollowup, ghi log. Không còn khái niệm "bấm cho có" (MANUAL_DISMISS) vì
// nút này không còn là no-op nữa — 3 action duy nhất còn lại ở trang chi tiết
// chăm sóc lại (nút này, Spam, Đủ tiêu chuẩn) đều là tiến triển thật, nên
// followupOutcome ở đây luôn là STATUS_CHANGED. Vì vậy cũng không tăng
// followupResolvedCount nữa — số đó giờ đếm số lần MARKETING gửi yêu cầu (xem
// pushFollowup() ở trên), không phải số lần Sale xử lý.
// ---------------------------------------------------------------------------
export async function resolveFollowup(actor: CurrentUser, interactionId: string, note: string) {
  if (actor.role === ROLES.SALES) requireValidSaleBranchScope(actor);

  const trimmedNote = note.trim();
  if (!trimmedNote) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng ghi lại đã xử lý như thế nào.");

  const lead = await loadInteractionOr404(interactionId);
  if (!canAccessBranch(actor, lead.assignedBranchCode)) throw Errors.forbidden("Bạn không được xử lý yêu cầu chăm sóc lại của cơ sở này.");
  if (!lead.needsFollowup) {
    throw new ApiError(409, "DATA_CHANGED", "Yêu cầu chăm sóc lại này đã được xử lý hoặc không còn hiệu lực. Hãy tải lại danh sách.");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const data: Prisma.InteractionUncheckedUpdateInput = {
      version: { increment: 1 },
      statusName: STATUS.PROCESSING,
      needsFollowup: false,
      followupTargetSaleEmail: null,
      followupHandledByEmail: actor.email,
      followupHandledAt: now,
      followupOutcome: FOLLOWUP_OUTCOME.STATUS_CHANGED,
      updatedByEmail: actor.email,
      updatedAt: now,
      ...(actor.role === ROLES.SALES ? { assignedSaleEmail: actor.email } : {}),
    };
    await tx.interaction.update({ where: { interactionId }, data });

    // Đồng bộ Customer nếu lead này từng đủ tiêu chuẩn từ trước (customerKey đã
    // có) — mirror nhánh Có nhu cầu trong updateStatus(). Phần lớn trường hợp
    // followup chỉ áp dụng cho lead chưa từng đủ điều kiện nên customerKey
    // thường vẫn null, updateMany bỏ qua an toàn.
    if (lead.customerKey) {
      await tx.customer.updateMany({ where: { customerKey: lead.customerKey }, data: { currentStatusName: STATUS.PROCESSING, lastTouchAt: now } });
    }

    // 1 dòng duy nhất trong interaction_field_logs — vừa là "lịch sử chăm sóc
    // lại" (getFollowupHistory() đọc theo fieldKey này) vừa để
    // loadFollowupResolveNotes() (followup-tracking) tra lại ghi chú xử lý.
    await logInteractionActivity(tx, actor, interactionId, INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED, {
      oldValue: lead.statusName,
      newValue: STATUS.PROCESSING,
      note: trimmedNote,
    });

    return getInteractionDetail(actor, interactionId, tx);
  });
}

// ---------------------------------------------------------------------------
// Leader/Admin điều chuyển người phụ trách — chỉ áp dụng lead đã Đủ tiêu chuẩn.
// ---------------------------------------------------------------------------
async function validateReassignTarget(targetEmail: string) {
  const target = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!target || !target.active || ![ROLES.SALES, ROLES.LEADER, ROLES.ADMIN].includes(target.role as never)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Người phụ trách mới chưa hoạt động hoặc không có vai trò phù hợp.");
  }
  return target;
}

async function applyReassign(actor: CurrentUser, interactionId: string, targetEmail: string, reason: string, expectedVersion: number) {
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
    await logInteractionActivity(tx, actor, interactionId, INTERACTION_ACTIVITY.REASSIGN, {
      oldValue: lead.assignedSaleEmail,
      newValue: targetEmail,
      note: reason,
    });
  });
}

export async function reassignInteraction(actor: CurrentUser, interactionId: string, targetEmail: string, reason: string, expectedVersion: number) {
  await validateReassignTarget(targetEmail);
  await applyReassign(actor, interactionId, targetEmail, reason, expectedVersion);
  return getInteractionDetail(actor, interactionId);
}

// Điều chuyển hàng loạt — Leader/Admin chọn nhiều liên hệ Đủ tiêu chuẩn cùng
// lúc, giao hết cho 1 Sale khác. Xử lý tuần tự, bỏ qua liên hệ nào lỗi (đổi
// trạng thái/version từ lúc chọn đến lúc gửi) thay vì huỷ toàn bộ.
export async function reassignInteractions(
  actor: CurrentUser,
  items: { interactionId: string; expectedVersion: number }[],
  targetEmail: string,
  reason: string
): Promise<{ reassigned: string[]; skipped: string[] }> {
  await validateReassignTarget(targetEmail);

  const reassigned: string[] = [];
  const skipped: string[] = [];
  for (const { interactionId, expectedVersion } of items) {
    try {
      await applyReassign(actor, interactionId, targetEmail, reason, expectedVersion);
      reassigned.push(interactionId);
    } catch {
      skipped.push(interactionId);
    }
  }
  return { reassigned, skipped };
}

// ---------------------------------------------------------------------------
// Admin xử lý Spam ở /admin/spam-review — mirror ý tưởng của pushFollowup()
// (Marketing gửi "Chăm sóc lại") nhưng bắt đầu từ Spam thay vì Chờ/Có nhu cầu,
// nên không tái dùng được nguyên hàm đó. 2 hành động: khôi phục về "Có nhu
// cầu" rồi đẩy thẳng vào hàng đợi Chăm sóc lại (Leader phân bổ tiếp ở
// /followup-assign), hoặc xoá hẳn liên hệ rác — chỉ áp dụng cho liên hệ ĐANG
// Spam tại thời điểm xử lý (bỏ qua nếu đã đổi trạng thái từ lúc chọn).
// ---------------------------------------------------------------------------
export async function restoreSpamToFollowup(
  actor: CurrentUser,
  interactionIds: string[],
  note?: string
): Promise<{ restored: number; skipped: number }> {
  let restored = 0;
  let skipped = 0;
  const now = new Date();

  for (const interactionId of interactionIds) {
    const lead = await prisma.interaction.findUnique({ where: { interactionId } });
    if (!lead || canonicalStatusKey(lead.statusName) !== "SPAM") {
      skipped++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.interaction.update({
        where: { interactionId },
        data: {
          version: { increment: 1 },
          statusName: STATUS.WAITING,
          updatedByEmail: actor.email,
          updatedAt: now,
          closedAt: null,
          phoneRaw: null,
          phoneNormalized: null,
          phoneCapturedAt: null,
          receivedAt: null,
          needsFollowup: true,
          mktPushedAt: now,
          mktPushedByEmail: actor.email,
          mktSuggestion: note || null,
          followupTargetSaleEmail: null,
          followupResolvedCount: { increment: 1 },
        },
      });
      if (lead.customerKey) {
        // Hiếm khi xảy ra (liên hệ này từng Đủ tiêu chuẩn trước khi bị đóng
        // Spam) — cập nhật lại Customer tương ứng cho khớp trạng thái mới.
        await tx.customer.updateMany({
          where: { customerKey: lead.customerKey },
          data: { currentStatusName: STATUS.WAITING, lastTouchAt: now },
        });
      }
      await logAction(
        tx,
        actor,
        SYSTEM_LOG_ACTION.RESTORE_SPAM_TO_FOLLOWUP,
        interactionId,
        { status: lead.statusName },
        { status: STATUS.WAITING },
        "SUCCESS",
        note
      );
      await logInteractionActivity(tx, actor, interactionId, INTERACTION_ACTIVITY.SPAM_RESTORE, {
        oldValue: lead.statusName,
        newValue: STATUS.WAITING,
        note: note || null,
      });
    });
    restored++;
  }

  return { restored, skipped };
}

export async function deleteSpamInteractions(
  actor: CurrentUser,
  interactionIds: string[],
  reason?: string
): Promise<{ deleted: number; skipped: number }> {
  let deleted = 0;
  let skipped = 0;

  for (const interactionId of interactionIds) {
    const lead = await prisma.interaction.findUnique({ where: { interactionId } });
    if (!lead || canonicalStatusKey(lead.statusName) !== "SPAM") {
      skipped++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      // Ghi log TRƯỚC khi xoá — system_log.interaction_id ON DELETE SET NULL
      // (xem schema.prisma) nên dòng log này vẫn còn nguyên vẹn sau khi liên
      // hệ bị xoá, chỉ mất liên kết. InteractionFieldLog thì cascade xoá theo
      // (không cần giữ vì lịch sử "của" 1 liên hệ không còn tồn tại thì cũng
      // hết ý nghĩa).
      await logAction(
        tx,
        actor,
        SYSTEM_LOG_ACTION.DELETE_SPAM_INTERACTION,
        interactionId,
        { customerName: lead.customerName, statusName: lead.statusName, fanpageName: lead.fanpageName },
        null,
        "SUCCESS",
        reason
      );
      await tx.interaction.delete({ where: { interactionId } });
    });
    deleted++;
  }

  return { deleted, skipped };
}

export { detailInclude, toDetail };
