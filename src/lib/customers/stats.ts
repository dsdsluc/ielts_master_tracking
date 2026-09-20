// Chỉ tiêu tư vấn ghi danh theo tháng — tách hẳn khỏi Interaction, chỉ dựa
// trên Customer.assignedToEmail/enrolledAt.
import { prisma } from "@/lib/prisma";
import { SALE_LIKE_ROLES, CUSTOMER_STAGE } from "@/lib/interactions/constants";
import { currentKpiMonth, getMonthlyKpiTarget } from "@/lib/interactions/settings";

export type KpiPeriod = { target: number; achieved: number };
export type SalePersonalKpi = {
  month: string;
  mineAssigned: number;
  totalAssigned: number;
  companyTarget: number;
  daily: KpiPeriod;
  weekly: KpiPeriod;
  monthly: KpiPeriod;
};

// Export để dùng chung với lib/admin/monthly-report.ts — cùng 1 định nghĩa
// "khoảng ngày của 1 tháng" cho mọi nơi tính KPI/báo cáo theo tháng.
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Monday = 1 .. Sunday = 7
  const start = new Date(d);
  start.setDate(d.getDate() - (day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function computeSalePersonalKpi(email: string): Promise<SalePersonalKpi> {
  const month = currentKpiMonth();
  const { start, end } = monthRange(month);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(now);

  const [companyTarget, mineAssigned, totalAssigned, monthlyAchieved, weeklyAchieved, dailyAchieved] = await Promise.all([
    getMonthlyKpiTarget(month),
    prisma.customer.count({ where: { assignedToEmail: email, assignedAt: { gte: start, lt: end } } }),
    prisma.customer.count({ where: { assignedAt: { gte: start, lt: end } } }),
    prisma.customer.count({ where: { assignedToEmail: email, enrolledAt: { gte: start, lt: end } } }),
    prisma.customer.count({ where: { assignedToEmail: email, enrolledAt: { gte: weekStart } } }),
    prisma.customer.count({ where: { assignedToEmail: email, enrolledAt: { gte: todayStart } } }),
  ]);

  const monthlyTarget = totalAssigned > 0 ? Math.round((companyTarget * mineAssigned) / totalAssigned) : 0;
  const remaining = Math.max(0, monthlyTarget - monthlyAchieved);

  const daysInMonth = new Date(end.getTime() - 1).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

  return {
    month,
    mineAssigned,
    totalAssigned,
    companyTarget,
    daily: { target: Math.ceil(remaining / daysLeft), achieved: dailyAchieved },
    weekly: { target: Math.ceil(remaining / weeksLeft), achieved: weeklyAchieved },
    monthly: { target: monthlyTarget, achieved: monthlyAchieved },
  };
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

/** Bảng chỉ tiêu từng Sale cho Leader — chỉ Leader/Admin gọi, Customer không
 * scope theo cơ sở nên luôn tính trên toàn công ty. Nhận `month` tuỳ chọn để
 * tính lại cho 1 THÁNG ĐÃ QUA (vd. email tổng kết KPI cuối tháng ở
 * /api/cron/kpi-month-summary) — mặc định tháng hiện tại như trước giờ. */
export async function computeTeamPersonalKpi(month: string = currentKpiMonth()): Promise<TeamPersonalKpi> {
  const { start, end } = monthRange(month);

  const [sales, companyTarget, assignedGroups, enrolledGroups] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES }, active: true }, select: { email: true, fullName: true } }),
    getMonthlyKpiTarget(month),
    prisma.customer.groupBy({ by: ["assignedToEmail"], where: { assignedAt: { gte: start, lt: end }, assignedToEmail: { not: null } }, _count: { _all: true } }),
    prisma.customer.groupBy({ by: ["assignedToEmail"], where: { enrolledAt: { gte: start, lt: end }, assignedToEmail: { not: null } }, _count: { _all: true } }),
  ]);

  const assignedByEmail = new Map(assignedGroups.map((g) => [g.assignedToEmail as string, g._count._all]));
  const enrolledByEmail = new Map(enrolledGroups.map((g) => [g.assignedToEmail as string, g._count._all]));
  const totalAssigned = assignedGroups.reduce((sum, g) => sum + g._count._all, 0);

  const rows: TeamKpiRow[] = sales
    .map((s) => {
      const mineAssigned = assignedByEmail.get(s.email) ?? 0;
      const enrolled = enrolledByEmail.get(s.email) ?? 0;
      const personalTarget = totalAssigned > 0 ? Math.round((companyTarget * mineAssigned) / totalAssigned) : 0;
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
    .filter((r) => r.mineAssigned > 0);

  return { month, companyTarget, totalAssigned, rows };
}

export type MonthlyKpiProgress = { month: string; enrolled: number; target: number };

// Customer không có branchCode riêng (tách khỏi Interaction) — công ty chung
// 1 chỉ tiêu duy nhất, không lọc theo cơ sở (chỉ Leader/Admin gọi hàm này,
// vốn đã thấy toàn công ty).
export async function computeMonthlyKpiProgress(): Promise<MonthlyKpiProgress> {
  const month = currentKpiMonth();
  const { start, end } = monthRange(month);
  const [enrolled, target] = await Promise.all([
    prisma.customer.count({ where: { enrolledAt: { gte: start, lt: end } } }),
    getMonthlyKpiTarget(month),
  ]);
  return { month, enrolled, target };
}

export async function computeFunnelSummary(windowStart: Date): Promise<{ assigned: number; enrolled: number }> {
  const [assigned, enrolled] = await Promise.all([
    prisma.customer.count({ where: { assignedAt: { gte: windowStart } } }),
    prisma.customer.count({ where: { enrolledAt: { gte: windowStart } } }),
  ]);
  return { assigned, enrolled };
}

export const CUSTOMER_STAGE_ORDER = Object.values(CUSTOMER_STAGE);
