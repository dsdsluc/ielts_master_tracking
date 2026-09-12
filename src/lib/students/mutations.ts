import { prisma } from "@/lib/prisma";
import { ApiError, Errors } from "@/lib/interactions/errors";
import {
  CAN_REASSIGN,
  ROLES,
  STUDENT_STAGE_VALUES,
  SYSTEM_LOG_ACTION,
  canonicalStatusKey,
} from "@/lib/interactions/constants";
import { requireRole } from "@/lib/interactions/scope";
import { logAction } from "@/lib/interactions/audit";
import type { CurrentUser } from "@/lib/auth/dal";

async function loadStudentProfileOr404(id: string) {
  const row = await prisma.studentProfile.findUnique({ where: { id } });
  if (!row) throw Errors.notFound();
  return row;
}

/** Sale được gán, hoặc Leader/Admin — không mở rộng thêm vai trò khác. */
function requireOwnerOrLeader(actor: CurrentUser, assignedToEmail: string): void {
  if (actor.email === assignedToEmail) return;
  requireRole(actor, CAN_REASSIGN);
}

// Sale nhận việc thật sự, nhưng Leader/Admin có thể tự phân cho chính mình
// nếu họ cũng trực tiếp gọi tư vấn — mirror đúng nhóm vai trò hợp lệ đã dùng
// ở reassignInteraction() (mutations.ts của Interaction).
const ASSIGNABLE_TARGET_ROLES: string[] = [ROLES.SALES, ROLES.LEADER, ROLES.ADMIN];

async function assignOne(actor: CurrentUser, interactionId: string, targetEmail: string) {
  const lead = await prisma.interaction.findUnique({ where: { interactionId } });
  if (!lead) throw Errors.notFound();
  if (canonicalStatusKey(lead.statusName) !== "PHONE") {
    throw new ApiError(422, "VALIDATION_ERROR", "Chỉ phân bổ được liên hệ đã Đủ tiêu chuẩn (có SĐT).");
  }

  const existing = await prisma.studentProfile.findFirst({ where: { interactionId } });
  if (existing) throw new ApiError(409, "CONFLICT", "Liên hệ này đã được phân bổ cho 1 học viên rồi.");

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const profile = await tx.studentProfile.create({
      data: {
        interactionId: lead.interactionId,
        studentName: lead.customerName,
        phone: lead.phoneNormalized ?? lead.phoneRaw ?? "",
        assignedToEmail: targetEmail,
        assignedByEmail: actor.email,
        assignedAt: now,
        createdAt: now,
      },
    });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.ASSIGN_STUDENT, lead.interactionId, null, {
      studentProfileId: profile.id,
      assignedToEmail: targetEmail,
    });
    return profile;
  });
}

// ---------------------------------------------------------------------------
// Phân bổ HÀNG LOẠT — Leader/Admin chọn 1 hay nhiều liên hệ Đủ tiêu chuẩn,
// giao cùng lúc cho 1 Sale (hoặc chính họ nếu tự trực tiếp gọi tư vấn).
// Xử lý tuần tự, bỏ qua liên hệ nào lỗi (đã được phân bổ trước đó, đổi trạng
// thái...) thay vì huỷ toàn bộ — mirror đúng pattern claimManyForWorkspace().
// ---------------------------------------------------------------------------
export async function createStudentAssignments(
  actor: CurrentUser,
  input: { interactionIds: string[]; assignedToEmail: string }
): Promise<{ assigned: string[]; skipped: string[] }> {
  requireRole(actor, CAN_REASSIGN);

  const target = await prisma.user.findUnique({ where: { email: input.assignedToEmail } });
  if (!target || !target.active || !ASSIGNABLE_TARGET_ROLES.includes(target.role)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Người được chọn chưa hoạt động hoặc không đúng vai trò.");
  }

  const assigned: string[] = [];
  const skipped: string[] = [];
  for (const interactionId of input.interactionIds) {
    try {
      await assignOne(actor, interactionId, target.email);
      assigned.push(interactionId);
    } catch {
      skipped.push(interactionId);
    }
  }
  return { assigned, skipped };
}

export type UpdateStudentProfileInput = Partial<{
  studentName: string;
  age: number | null;
  dateOfBirth: Date | null;
  gender: string | null;
  parentName: string | null;
  address: string | null;
  level: string | null;
  trainingTrack: string | null;
  school: string | null;
  aspiration: string | null;
  stage: string | null;
  stageReason: string | null;
  caseDeadline: Date | null;
  needsLeaderSupport: boolean;
  appointmentAt: Date | null;
  note: string | null;
}>;

// ---------------------------------------------------------------------------
// Sale được gán (hoặc Leader/Admin) cập nhật thông tin học viên / tiến trình.
// ---------------------------------------------------------------------------
export async function updateStudentProfile(actor: CurrentUser, id: string, input: UpdateStudentProfileInput) {
  const profile = await loadStudentProfileOr404(id);
  requireOwnerOrLeader(actor, profile.assignedToEmail);

  if (input.stage && !(STUDENT_STAGE_VALUES as string[]).includes(input.stage)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Mốc tư vấn không hợp lệ.");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.studentProfile.update({
      where: { id },
      data: { ...input, updatedByEmail: actor.email, updatedAt: now },
    });
    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.UPDATE_STUDENT_STAGE,
      profile.interactionId,
      { stage: profile.stage, stageReason: profile.stageReason },
      { stage: updated.stage, stageReason: updated.stageReason }
    );
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Thêm 1 dòng nhật ký chăm sóc (mỗi lần gọi điện) — tự ghi kèm mốc hiện tại
// của hồ sơ để sau này xem lại đúng bối cảnh lúc ghi.
// ---------------------------------------------------------------------------
export async function addCareLog(actor: CurrentUser, studentProfileId: string, content: string) {
  const profile = await loadStudentProfileOr404(studentProfileId);
  requireOwnerOrLeader(actor, profile.assignedToEmail);

  const trimmed = content.trim();
  if (!trimmed) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập nội dung nhật ký.");

  return prisma.studentCareLog.create({
    data: {
      studentProfileId,
      loggedByEmail: actor.email,
      content: trimmed,
      stageAtLogTime: profile.stage,
    },
  });
}

// ---------------------------------------------------------------------------
// Leader/Admin chuyển giao hồ sơ đang tư vấn sang Sale khác — dùng khi Sale
// hiện tại không hiệu quả/quá tải/nghỉ việc. Khác reassignInteraction() (mutations.ts
// của Interaction — chỉ đổi assignedSaleEmail của lead): cái này đổi
// assignedToEmail của StudentProfile, và re-stamp assignedAt = now() để
// "Việc cần làm hôm nay"/thống kê "chưa gọi" không tính oan Sale mới vừa nhận.
// Không thêm cột lịch sử riêng — tự ghi 1 dòng vào StudentCareLog (đã có sẵn
// timeline) để không phá vỡ thiết kế "stageReason là 1 ô tự do" đã chọn.
// ---------------------------------------------------------------------------
export async function transferStudentProfile(actor: CurrentUser, id: string, targetEmail: string, reason: string) {
  requireRole(actor, CAN_REASSIGN);
  const profile = await loadStudentProfileOr404(id);

  const target = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!target || !target.active || !ASSIGNABLE_TARGET_ROLES.includes(target.role)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Người được chọn chưa hoạt động hoặc không đúng vai trò.");
  }
  if (target.email === profile.assignedToEmail) {
    throw new ApiError(422, "VALIDATION_ERROR", "Học viên đã thuộc về tư vấn viên này rồi.");
  }
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập lý do chuyển giao.");

  const previousEmail = profile.assignedToEmail;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.studentProfile.update({
      where: { id },
      data: {
        assignedToEmail: target.email,
        assignedByEmail: actor.email,
        assignedAt: now,
        updatedByEmail: actor.email,
        updatedAt: now,
      },
    });
    await tx.studentCareLog.create({
      data: {
        studentProfileId: id,
        loggedByEmail: actor.email,
        stageAtLogTime: profile.stage,
        content: `Chuyển giao từ ${previousEmail} sang ${target.fullName} (${target.email}). Lý do: ${trimmedReason}`,
      },
    });
    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.TRANSFER_STUDENT,
      profile.interactionId,
      { assignedToEmail: previousEmail },
      { assignedToEmail: target.email },
      "SUCCESS",
      trimmedReason
    );
    return updated;
  });
}
