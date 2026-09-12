import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";
import { STUDENT_STAGE, STUDENT_STAGE_VALUES } from "@/lib/interactions/constants";
import { isLeaderLike } from "@/lib/interactions/scope";
import { studentProfileScopeWhere } from "@/lib/students/queries";
import type { CurrentUser } from "@/lib/auth/dal";
import type { Prisma } from "@/generated/prisma/client";

const APPOINTMENT_STAGES: string[] = [STUDENT_STAGE.TEST_SCHEDULED, STUDENT_STAGE.TRIAL_SCHEDULED];

export type SaleRankRow = {
  email: string;
  fullName: string;
  total: number;
  enrolled: number;
  notInterested: number;
  inProgress: number;
  notCalled: number;
  noActivity: number;
  conversionRate: number;
};

export type DropOffRow = {
  studentName: string;
  assignedToName: string;
  stage: string | null;
  stageReason: string;
  updatedAt: string;
};

export type ProfileSummary = {
  id: string;
  studentName: string;
  phone: string;
  assignedToEmail: string;
  assignedToName: string;
  stage: string | null;
  assignedAt: string;
  careLogCount: number;
};

export type CaseSupportRow = {
  id: string;
  studentName: string;
  assignedToName: string;
  stage: string | null;
  stageReason: string;
  caseDeadline: string | null;
  overdueDays: number | null;
};

export type OverdueAppointmentRow = {
  id: string;
  studentName: string;
  assignedToName: string;
  stage: string | null;
  appointmentAt: string;
  overdueDays: number;
};

export type StudentStats = {
  total: number;
  enrolled: number;
  conversionRate: number;
  saleCount: number;
  totalNoActivity: number;
  totalCareLogs: number;
  saleRanking: SaleRankRow[];
  stageCounts: { label: string; count: number }[];
  recentDropOffs: DropOffRow[];
  neglected: ProfileSummary[];
  casesNeedingSupport: CaseSupportRow[];
  overdueAppointments: OverdueAppointmentRow[];
  // Danh sách đầy đủ (đã lọc theo khoảng ngày/scope) — dùng để lọc theo mốc
  // ngay trên trang (bấm vào 1 mốc ở "Phân bố theo mốc tư vấn") mà không cần
  // query lại DB, vì dữ liệu đã có sẵn trong lần tính này.
  profiles: ProfileSummary[];
};

const MAX_DROP_OFFS = 20;
const MAX_NEGLECTED = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function scopeCacheKey(actor: CurrentUser): string {
  if (isLeaderLike(actor) && actor.viewAllBranches) return "all";
  return actor.branchCode ?? "none";
}

async function compute(actor: CurrentUser, windowStart: Date): Promise<StudentStats> {
  const where: Prisma.StudentProfileWhereInput = {
    ...studentProfileScopeWhere(actor),
    assignedAt: { gte: windowStart },
  };

  const profiles = await prisma.studentProfile.findMany({
    where,
    include: { assignedTo: { select: { fullName: true } }, _count: { select: { careLogs: true } } },
    orderBy: { assignedAt: "desc" },
  });

  const now = Date.now();

  const total = profiles.length;
  const enrolled = profiles.filter((p) => p.stage === STUDENT_STAGE.ENROLLED).length;
  const conversionRate = total > 0 ? Math.round((enrolled / total) * 1000) / 10 : 0;
  const totalNoActivity = profiles.filter((p) => p._count.careLogs === 0).length;
  const totalCareLogs = profiles.reduce((sum, p) => sum + p._count.careLogs, 0);

  const bySale = new Map<
    string,
    { fullName: string; total: number; enrolled: number; notInterested: number; notCalled: number; noActivity: number }
  >();
  for (const p of profiles) {
    const entry = bySale.get(p.assignedToEmail) ?? {
      fullName: p.assignedTo.fullName,
      total: 0,
      enrolled: 0,
      notInterested: 0,
      notCalled: 0,
      noActivity: 0,
    };
    entry.total += 1;
    if (p.stage === STUDENT_STAGE.ENROLLED) entry.enrolled += 1;
    if (p.stage === STUDENT_STAGE.NOT_INTERESTED) entry.notInterested += 1;
    if (!p.stage) entry.notCalled += 1;
    if (p._count.careLogs === 0) entry.noActivity += 1;
    bySale.set(p.assignedToEmail, entry);
  }
  const saleRanking: SaleRankRow[] = Array.from(bySale.entries())
    .map(([email, v]) => ({
      email,
      fullName: v.fullName,
      total: v.total,
      enrolled: v.enrolled,
      notInterested: v.notInterested,
      inProgress: v.total - v.enrolled - v.notInterested,
      notCalled: v.notCalled,
      noActivity: v.noActivity,
      conversionRate: v.total > 0 ? Math.round((v.enrolled / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.enrolled - a.enrolled || b.conversionRate - a.conversionRate);

  const stageCounts = [
    { label: "Chưa gọi", count: profiles.filter((p) => !p.stage).length },
    ...STUDENT_STAGE_VALUES.map((stage) => ({ label: stage, count: profiles.filter((p) => p.stage === stage).length })),
  ];

  const recentDropOffs: DropOffRow[] = profiles
    .filter((p) => p.stageReason && p.stageReason.trim())
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, MAX_DROP_OFFS)
    .map((p) => ({
      studentName: p.studentName,
      assignedToName: p.assignedTo.fullName,
      stage: p.stage,
      stageReason: p.stageReason ?? "",
      updatedAt: (p.updatedAt ?? p.assignedAt).toISOString(),
    }));

  // Học viên chưa hề được ghi nhận 1 lượt chăm sóc nào — cũ nhất lên trước
  // (càng lâu càng cần can thiệp gấp), giới hạn 20 dòng để không tràn trang.
  const neglected: ProfileSummary[] = profiles
    .filter((p) => p._count.careLogs === 0)
    .sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime())
    .slice(0, MAX_NEGLECTED)
    .map((p) => toProfileSummary(p));

  // Case Sale đã đánh dấu cần Leader can thiệp — quá hạn deadline lên trước,
  // rồi tới chưa có deadline, để Leader không phải đọc từng dòng lý do.
  const casesNeedingSupport: CaseSupportRow[] = profiles
    .filter((p) => p.needsLeaderSupport)
    .map((p) => {
      const overdueDays = p.caseDeadline ? Math.floor((now - p.caseDeadline.getTime()) / MS_PER_DAY) : null;
      return {
        id: p.id,
        studentName: p.studentName,
        assignedToName: p.assignedTo.fullName,
        stage: p.stage,
        stageReason: p.stageReason ?? "",
        caseDeadline: p.caseDeadline ? p.caseDeadline.toISOString() : null,
        overdueDays,
      };
    })
    .sort((a, b) => (b.overdueDays ?? -Infinity) - (a.overdueDays ?? -Infinity));

  // Hồ sơ ở mốc "Đặt lịch test"/"Đặt lịch học thử" đã qua ngày hẹn nhưng chưa
  // cập nhật kết quả — trễ nhiều nhất lên trước.
  const overdueAppointments: OverdueAppointmentRow[] = profiles
    .filter((p) => APPOINTMENT_STAGES.includes(p.stage ?? "") && p.appointmentAt && p.appointmentAt.getTime() <= now)
    .map((p) => ({
      id: p.id,
      studentName: p.studentName,
      assignedToName: p.assignedTo.fullName,
      stage: p.stage,
      appointmentAt: p.appointmentAt!.toISOString(),
      overdueDays: Math.floor((now - p.appointmentAt!.getTime()) / MS_PER_DAY),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays);

  return {
    total,
    enrolled,
    conversionRate,
    saleCount: bySale.size,
    totalNoActivity,
    totalCareLogs,
    saleRanking,
    stageCounts,
    recentDropOffs,
    neglected,
    casesNeedingSupport,
    overdueAppointments,
    profiles: profiles.map((p) => toProfileSummary(p)),
  };
}

function toProfileSummary(p: {
  id: string;
  studentName: string;
  phone: string;
  assignedToEmail: string;
  assignedTo: { fullName: string };
  stage: string | null;
  assignedAt: Date;
  _count: { careLogs: number };
}): ProfileSummary {
  return {
    id: p.id,
    studentName: p.studentName,
    phone: p.phone,
    assignedToEmail: p.assignedToEmail,
    assignedToName: p.assignedTo.fullName,
    stage: p.stage,
    assignedAt: p.assignedAt.toISOString(),
    careLogCount: p._count.careLogs,
  };
}

/** Tổng hợp hiệu quả tư vấn học viên toàn đội (theo phạm vi cơ sở của actor)
 * trong `days` ngày gần nhất, tính theo StudentProfile.assignedAt. Cache
 * ngắn hạn — mirror computeMarketingDashboardData() (marketing-dashboard/page.tsx). */
export async function computeStudentStats(actor: CurrentUser, days: number): Promise<StudentStats> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - days);
  windowStart.setHours(0, 0, 0, 0);

  return cached(`student-stats:${scopeCacheKey(actor)}:${days}`, 90, () => compute(actor, windowStart));
}
