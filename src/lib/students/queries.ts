import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/interactions/errors";
import { ROLES, STATUS, STUDENT_STAGE } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch, isLeaderLike } from "@/lib/interactions/scope";
import type { CurrentUser } from "@/lib/auth/dal";
import type { Prisma } from "@/generated/prisma/client";

// Số ngày không có tương tác (chăm sóc hoặc mới được phân bổ) trước khi tính
// là "quá hạn" — mirror ý tưởng "Ngày chăm sóc đã quá hạn" ở file Excel gốc.
const OVERDUE_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Hồ sơ đã kết thúc phễu (chốt hoặc không quan tâm) thì không cần nhắc việc nữa.
const CLOSED_STAGES: string[] = [STUDENT_STAGE.ENROLLED, STUDENT_STAGE.NOT_INTERESTED];

// Mốc có ngày hẹn cụ thể — chỉ 2 mốc này dùng appointmentAt để tự phát hiện
// "quá hẹn mà chưa cập nhật kết quả".
const APPOINTMENT_STAGES: string[] = [STUDENT_STAGE.TEST_SCHEDULED, STUDENT_STAGE.TRIAL_SCHEDULED];

export type TodayTaskKind = "overdue_appointment" | "overdue_case" | "never_contacted" | "overdue_care";
const TASK_RANK: Record<TodayTaskKind, number> = {
  overdue_appointment: 4,
  overdue_case: 3,
  never_contacted: 2,
  overdue_care: 1,
};

export type TodayTask = {
  id: string;
  studentName: string;
  phone: string;
  stage: string | null;
  kind: TodayTaskKind;
  reason: string;
  days: number;
};

/** Liên hệ Đủ tiêu chuẩn, còn mở, và CHƯA có hồ sơ học viên nào liên kết —
 * đúng danh sách Leader/Admin chọn để phân bổ. */
export async function getAssignableLeads(actor: CurrentUser) {
  const where: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(actor),
    activeFlag: true,
    statusName: STATUS.PHONE,
    studentProfiles: { none: {} },
  };

  return prisma.interaction.findMany({
    where,
    select: {
      interactionId: true,
      customerName: true,
      phoneNormalized: true,
      phoneRaw: true,
      assignedBranchCode: true,
      sourceName: true,
      fanpageName: true,
      receivedAt: true,
      assignedBranch: { select: { name: true } },
    },
    orderBy: { receivedAt: "desc" },
  });
}

/** Sale đang hoạt động, cùng phạm vi cơ sở với actor — để chọn trong dialog
 * phân bổ (branchScopeWhere của Interaction dùng chung cấu trúc phân quyền
 * cơ sở nên tái dùng canAccessBranch trực tiếp trên user.branchCode). Bao gồm
 * cả Leader/Admin (kể cả chính actor) — Leader có thể tự nhận về mình nếu họ
 * cũng trực tiếp gọi tư vấn, không chỉ giao cho Sale. */
export async function getAssignableSales(actor: CurrentUser) {
  const sales = await prisma.user.findMany({
    where: { role: { in: [ROLES.SALES, ROLES.LEADER, ROLES.ADMIN] }, active: true },
    select: { email: true, fullName: true, branchCode: true },
    orderBy: { fullName: "asc" },
  });
  if (isLeaderLike(actor) && actor.viewAllBranches) return sales;
  return sales.filter((s) => s.email === actor.email || (s.branchCode && canAccessBranch(actor, s.branchCode)));
}

export function studentProfileScopeWhere(actor: CurrentUser): Prisma.StudentProfileWhereInput {
  if (actor.role === ROLES.SALES) return { assignedToEmail: actor.email };
  if (isLeaderLike(actor) && actor.viewAllBranches) return {};
  // Leader phạm vi 1 cơ sở: thấy hồ sơ có liên hệ gốc cùng cơ sở, hoặc hồ sơ
  // không có liên kết (không xác định được cơ sở nên không giấu đi).
  return {
    OR: [{ interactionId: null }, { interaction: { assignedBranchCode: actor.branchCode ?? "__NONE__" } }],
  };
}

export async function getStudentProfilesForActor(actor: CurrentUser) {
  return prisma.studentProfile.findMany({
    where: studentProfileScopeWhere(actor),
    include: {
      assignedTo: { select: { fullName: true } },
      interaction: { select: { sourceName: true, fanpageName: true } },
      careLogs: { orderBy: { loggedAt: "desc" }, take: 1, select: { loggedAt: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

/** "Việc cần làm hôm nay": hồ sơ trong phạm vi của actor đang cần hành động —
 * quá hẹn test/học thử chưa cập nhật kết quả, case đang cần Leader hỗ trợ,
 * chưa từng được chăm sóc, hoặc đã quá OVERDUE_DAYS ngày kể từ lần chăm sóc
 * gần nhất — loại trừ hồ sơ đã kết thúc phễu (đã chốt / không quan tâm). Mỗi
 * hồ sơ chỉ hiện 1 việc quan trọng nhất (ưu tiên: quá hẹn > case cần hỗ trợ >
 * chưa gọi > quá hạn chăm sóc), sắp theo mức ưu tiên rồi số ngày trễ giảm dần. */
export async function getTodayTasksForActor(actor: CurrentUser): Promise<TodayTask[]> {
  const profiles = await prisma.studentProfile.findMany({
    where: { ...studentProfileScopeWhere(actor), stage: { notIn: CLOSED_STAGES } },
    select: {
      id: true,
      studentName: true,
      phone: true,
      stage: true,
      assignedAt: true,
      appointmentAt: true,
      needsLeaderSupport: true,
      caseDeadline: true,
      careLogs: { orderBy: { loggedAt: "desc" }, take: 1, select: { loggedAt: true } },
    },
  });

  const now = Date.now();
  const tasks: TodayTask[] = [];
  for (const p of profiles) {
    const base = { id: p.id, studentName: p.studentName, phone: p.phone, stage: p.stage };

    if (APPOINTMENT_STAGES.includes(p.stage ?? "") && p.appointmentAt && p.appointmentAt.getTime() <= now) {
      const days = Math.floor((now - p.appointmentAt.getTime()) / MS_PER_DAY);
      tasks.push({ ...base, kind: "overdue_appointment", days, reason: days <= 0 ? "Đến hẹn hôm nay, cần cập nhật kết quả" : `Quá hẹn ${days} ngày, cần cập nhật kết quả` });
      continue;
    }

    if (p.needsLeaderSupport) {
      const days = p.caseDeadline ? Math.floor((now - p.caseDeadline.getTime()) / MS_PER_DAY) : 0;
      const overdueText = p.caseDeadline && days > 0 ? ` (quá hạn ${days} ngày)` : "";
      tasks.push({ ...base, kind: "overdue_case", days: Math.max(days, 0), reason: `Case cần Leader hỗ trợ${overdueText}` });
      continue;
    }

    const lastContactAt = p.careLogs[0]?.loggedAt ?? p.assignedAt;
    const neverContacted = p.careLogs.length === 0;
    const daysSince = Math.floor((now - lastContactAt.getTime()) / MS_PER_DAY);
    if (neverContacted && daysSince >= 1) {
      tasks.push({ ...base, kind: "never_contacted", days: daysSince, reason: `Chưa gọi — đã phân bổ ${daysSince} ngày trước` });
    } else if (daysSince >= OVERDUE_DAYS) {
      tasks.push({ ...base, kind: "overdue_care", days: daysSince, reason: `Quá hạn chăm sóc ${daysSince} ngày` });
    }
  }

  return tasks.sort((a, b) => TASK_RANK[b.kind] - TASK_RANK[a.kind] || b.days - a.days);
}

export async function getStudentProfileDetail(actor: CurrentUser, id: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { fullName: true, email: true } },
      assignedBy: { select: { fullName: true } },
      interaction: { select: { sourceName: true, fanpageName: true, rawLink: true, conversationLink: true } },
      careLogs: { orderBy: { loggedAt: "desc" }, include: { loggedBy: { select: { fullName: true } } } },
    },
  });
  if (!profile) throw Errors.notFound();
  if (actor.role === ROLES.SALES && profile.assignedToEmail !== actor.email) {
    throw Errors.forbidden("Bạn không được xem hồ sơ học viên này.");
  }
  return profile;
}
