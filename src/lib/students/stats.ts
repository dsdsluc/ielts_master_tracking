import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";
import { STUDENT_STAGE, STUDENT_STAGE_VALUES } from "@/lib/interactions/constants";
import { isLeaderLike } from "@/lib/interactions/scope";
import { currentKpiMonth, getMonthlyKpiTarget } from "@/lib/interactions/settings";
import { getAssignableSales, studentProfileScopeWhere } from "@/lib/students/queries";
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

function monthBounds(month: string): { monthStart: Date; monthEnd: Date } {
  const [y, m] = month.split("-").map(Number);
  return { monthStart: new Date(y, m - 1, 1), monthEnd: new Date(y, m, 1) };
}

export type MonthlyKpiProgress = { month: string; target: number; enrolled: number };

/** Tiến độ chỉ tiêu chốt học viên trong THÁNG DƯƠNG LỊCH hiện tại (Admin nhập
 * ở "Cấu hình hệ thống") — độc lập với bộ lọc "days" của trang thống kê vì
 * chỉ tiêu KPI luôn gắn với 1 tháng cụ thể. Đếm theo enrolledAt (mốc THỰC SỰ
 * chuyển sang Đã chốt, set 1 lần trong updateStudentProfile()) — không dùng
 * assignedAt vì đó là ngày Leader phân bổ, không phải ngày chốt. */
async function computeMonthlyKpiProgressUncached(actor: CurrentUser): Promise<MonthlyKpiProgress> {
  const month = currentKpiMonth();
  const { monthStart, monthEnd } = monthBounds(month);

  const [target, enrolled] = await Promise.all([
    getMonthlyKpiTarget(month),
    prisma.studentProfile.count({
      where: { ...studentProfileScopeWhere(actor), enrolledAt: { gte: monthStart, lt: monthEnd } },
    }),
  ]);
  return { month, target, enrolled };
}

export async function computeMonthlyKpiProgress(actor: CurrentUser): Promise<MonthlyKpiProgress> {
  return cached(`student-kpi:${scopeCacheKey(actor)}:${currentKpiMonth()}`, 90, () => computeMonthlyKpiProgressUncached(actor));
}

export type KpiPeriod = { target: number; achieved: number };

export type SalePersonalKpi = {
  month: string;
  companyTarget: number;
  totalAssigned: number;
  mineAssigned: number;
  daily: KpiPeriod;
  weekly: KpiPeriod;
  monthly: KpiPeriod;
};

function startOfDay(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Tuần theo quy ước Thứ Hai — Chủ Nhật.
function startOfWeek(d: Date): Date {
  const date = startOfDay(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diffToMonday);
  return date;
}

/** Chỉ tiêu CÁ NHÂN của 1 Sale trong tháng = chỉ tiêu CÔNG TY (companyTarget,
 * Admin nhập ở "Cấu hình hệ thống") chia theo đúng TỶ TRỌNG số học viên được
 * phân bổ cho Sale đó trên tổng số học viên phân bổ toàn công ty trong tháng:
 * personalTarget = round(companyTarget × mineAssigned / totalAssigned).
 * Vd: chỉ tiêu công ty 100, Sale nhận 10/19 học viên toàn công ty (52.6%) thì
 * chỉ tiêu cá nhân ≈ round(100 × 52.6%) = 53. Cộng dồn chỉ tiêu cá nhân của
 * mọi Sale lại đúng bằng chỉ tiêu công ty (sai số làm tròn không đáng kể).
 *
 * (Công thức trước đây — personalTarget = mineAssigned × shareRatio, tức là
 * BÌNH PHƯƠNG mineAssigned chia totalAssigned — hoàn toàn không dùng tới
 * companyTarget dù UI có hiển thị, và không có ý nghĩa nghiệp vụ rõ ràng. Đã
 * xác nhận lại với người dùng đây là lỗi cần sửa, không phải chủ đích.)
 *
 * Chỉ tiêu ngày/tuần chia theo TIẾN ĐỘ CÒN LẠI (personalTarget trừ số đã chốt
 * trong tháng), trải đều cho số ngày/tuần còn lại của tháng — không phải chia
 * đều cố định — để tự điều chỉnh: đang trễ tiến độ thì chỉ tiêu ngày/tuần tự
 * tăng lên, đã đạt hoặc vượt thì về 0. */
async function computeSalePersonalKpiUncached(email: string): Promise<SalePersonalKpi> {
  const month = currentKpiMonth();
  const { monthStart, monthEnd } = monthBounds(month);
  const assignedInMonth: Prisma.StudentProfileWhereInput = { assignedAt: { gte: monthStart, lt: monthEnd } };

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);

  const [companyTarget, totalAssigned, mineAssigned, enrolledThisMonth, enrolledThisWeek, enrolledToday] = await Promise.all([
    getMonthlyKpiTarget(month),
    prisma.studentProfile.count({ where: assignedInMonth }),
    prisma.studentProfile.count({ where: { ...assignedInMonth, assignedToEmail: email } }),
    prisma.studentProfile.count({ where: { assignedToEmail: email, enrolledAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.studentProfile.count({ where: { assignedToEmail: email, enrolledAt: { gte: weekStart, lt: weekEnd } } }),
    prisma.studentProfile.count({ where: { assignedToEmail: email, enrolledAt: { gte: dayStart, lt: dayEnd } } }),
  ]);

  const shareRatio = totalAssigned > 0 ? mineAssigned / totalAssigned : 0;
  const personalTarget = Math.round(companyTarget * shareRatio);
  const remaining = Math.max(0, personalTarget - enrolledThisMonth);

  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / MS_PER_DAY);
  const dayOfMonth = Math.floor((dayStart.getTime() - monthStart.getTime()) / MS_PER_DAY) + 1;
  const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);
  const weeksLeftInMonth = Math.max(1, Math.ceil(daysLeftInMonth / 7));

  return {
    month,
    companyTarget,
    totalAssigned,
    mineAssigned,
    daily: { target: Math.ceil(remaining / daysLeftInMonth), achieved: enrolledToday },
    weekly: { target: Math.ceil(remaining / weeksLeftInMonth), achieved: enrolledThisWeek },
    monthly: { target: personalTarget, achieved: enrolledThisMonth },
  };
}

export async function computeSalePersonalKpi(email: string): Promise<SalePersonalKpi> {
  // v4: personalTarget đổi công thức — xem giải thích ở computeSalePersonalKpiUncached().
  return cached(`sale-personal-kpi:v4:${email}:${currentKpiMonth()}`, 90, () => computeSalePersonalKpiUncached(email));
}

export type TeamKpiRow = {
  email: string;
  fullName: string;
  mineAssigned: number;
  personalTarget: number;
  enrolled: number;
  remaining: number;
  met: boolean;
};

export type TeamPersonalKpi = {
  month: string;
  companyTarget: number;
  totalAssigned: number;
  rows: TeamKpiRow[];
};

/** Bản "cả team" của computeSalePersonalKpi — cùng công thức
 * (personalTarget = round(companyTarget × mineAssigned/totalAssigned)) nhưng
 * gộp query theo groupBy thay vì lặp N lần cho N Sale, để Dashboard Leader
 * tải 1 lần cho cả đội thay vì 1 round-trip DB riêng mỗi người. Chỉ trả về
 * Sale có ít nhất 1 học viên được phân bổ trong tháng — Sale chưa được giao
 * gì thì chưa có chỉ tiêu để so sánh. */
async function computeTeamPersonalKpiUncached(actor: CurrentUser): Promise<TeamPersonalKpi> {
  const month = currentKpiMonth();
  const { monthStart, monthEnd } = monthBounds(month);
  const scope = studentProfileScopeWhere(actor);
  const assignedInMonth: Prisma.StudentProfileWhereInput = { ...scope, assignedAt: { gte: monthStart, lt: monthEnd } };

  const [companyTarget, totalAssigned, assignedGroups, enrolledGroups, sales] = await Promise.all([
    getMonthlyKpiTarget(month),
    prisma.studentProfile.count({ where: assignedInMonth }),
    prisma.studentProfile.groupBy({ by: ["assignedToEmail"], where: assignedInMonth, _count: { _all: true } }),
    prisma.studentProfile.groupBy({
      by: ["assignedToEmail"],
      where: { ...scope, enrolledAt: { gte: monthStart, lt: monthEnd } },
      _count: { _all: true },
    }),
    getAssignableSales(actor),
  ]);

  const assignedByEmail = new Map(assignedGroups.map((g) => [g.assignedToEmail, g._count._all]));
  const enrolledByEmail = new Map(enrolledGroups.map((g) => [g.assignedToEmail, g._count._all]));

  const rows: TeamKpiRow[] = sales
    .map((s) => {
      const mineAssigned = assignedByEmail.get(s.email) ?? 0;
      const shareRatio = totalAssigned > 0 ? mineAssigned / totalAssigned : 0;
      const personalTarget = Math.round(companyTarget * shareRatio);
      const enrolled = enrolledByEmail.get(s.email) ?? 0;
      return {
        email: s.email,
        fullName: s.fullName,
        mineAssigned,
        personalTarget,
        enrolled,
        remaining: Math.max(0, personalTarget - enrolled),
        met: enrolled >= personalTarget,
      };
    })
    .filter((r) => r.mineAssigned > 0)
    .sort((a, b) => b.remaining - a.remaining || b.mineAssigned - a.mineAssigned);

  return { month, companyTarget, totalAssigned, rows };
}

export async function computeTeamPersonalKpi(actor: CurrentUser): Promise<TeamPersonalKpi> {
  return cached(`team-personal-kpi:${scopeCacheKey(actor)}:${currentKpiMonth()}`, 90, () => computeTeamPersonalKpiUncached(actor));
}
