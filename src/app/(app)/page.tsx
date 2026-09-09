import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { dayKey } from "@/lib/day-key";
import { cached } from "@/lib/cache";
import { DashboardFilterBar } from "@/app/(app)/dashboard-filter-bar";
import { DashboardChart, type ChartPoint, type ChartSeries } from "@/app/(app)/dashboard-chart";

const REPORT_ROLES = [ROLES.LEADER, ROLES.MARKETING, ROLES.BOARD, ROLES.ADMIN] as const;
const DAYS_OPTIONS = [7, 30, 90];
const MAX_CHART_SLOTS = 5;

const STATUS_SERIES: ChartSeries[] = [
  { key: STATUS.WAITING, label: STATUS.WAITING, color: "var(--color-status-waiting)" },
  { key: STATUS.PROCESSING, label: STATUS.PROCESSING, color: "var(--color-status-received)" },
  { key: STATUS.PHONE, label: STATUS.PHONE, color: "var(--color-status-qualified)" },
  { key: STATUS.SPAM, label: STATUS.SPAM, color: "var(--color-status-spam)" },
];
const CHART_PALETTE = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

type DashboardKpi = { total: number; waiting: number; processing: number; qualified: number; spam: number };
type DashboardData = { kpi: DashboardKpi; chartData: ChartPoint[]; series: ChartSeries[] };

// Quét toàn bộ interaction trong cửa sổ ngày rồi group theo trạng thái/chi
// nhánh/nguồn trong JS — nặng nhất trang, và đây là trang mặc định BGĐ/Leader/
// Admin/Marketing mở đầu tiên nên tần suất xem cao. Cache theo đúng scope thật
// (branchScopeWhere) bằng cách dùng chính where-clause làm 1 phần khoá — tự
// động đúng nếu logic phân quyền chi nhánh đổi sau này, khỏi duy trì 2 chỗ.
async function computeDashboardData(
  where: Prisma.InteractionWhereInput,
  days: number,
  windowStart: Date,
  groupBy: "status" | "branch" | "source",
  branchNameByCode: Map<string, string>
): Promise<DashboardData> {
  const rows = await prisma.interaction.findMany({
    where,
    select: { createdLeadAt: true, statusName: true, assignedBranchCode: true, sourceName: true },
  });

  // KPI: luôn theo trạng thái, độc lập với bộ lọc "Nhóm theo" của biểu đồ.
  const kpi: DashboardKpi = { total: rows.length, waiting: 0, processing: 0, qualified: 0, spam: 0 };
  for (const row of rows) {
    if (row.statusName === STATUS.WAITING) kpi.waiting++;
    else if (row.statusName === STATUS.PROCESSING) kpi.processing++;
    else if (row.statusName === STATUS.PHONE) kpi.qualified++;
    else if (row.statusName === STATUS.SPAM) kpi.spam++;
  }

  // Chọn series theo lựa chọn "Nhóm theo" — tối đa 5 mục (đủ số màu chart-1..5),
  // Nguồn có thể nhiều hơn nên gộp phần đuôi vào "Khác".
  let series: ChartSeries[];
  let categoryOf: (row: (typeof rows)[number]) => string;

  if (groupBy === "branch") {
    const totalByBranch = new Map<string, number>();
    for (const row of rows) totalByBranch.set(row.assignedBranchCode, (totalByBranch.get(row.assignedBranchCode) ?? 0) + 1);
    const orderedCodes = [...totalByBranch.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code).slice(0, MAX_CHART_SLOTS);
    series = orderedCodes.map((code, i) => ({ key: code, label: branchNameByCode.get(code) ?? code, color: CHART_PALETTE[i] }));
    categoryOf = (row) => row.assignedBranchCode;
  } else if (groupBy === "source") {
    const totalBySource = new Map<string, number>();
    for (const row of rows) totalBySource.set(row.sourceName, (totalBySource.get(row.sourceName) ?? 0) + 1);
    const ordered = [...totalBySource.entries()].sort((a, b) => b[1] - a[1]);
    const top = ordered.slice(0, MAX_CHART_SLOTS - 1).map(([name]) => name);
    const hasOther = ordered.length > top.length;
    series = top.map((name, i) => ({ key: name, label: name, color: CHART_PALETTE[i] }));
    if (hasOther) series.push({ key: "__other__", label: "Khác", color: CHART_PALETTE[series.length] });
    const topSet = new Set(top);
    categoryOf = (row) => (topSet.has(row.sourceName) ? row.sourceName : "__other__");
  } else {
    series = STATUS_SERIES;
    categoryOf = (row) => row.statusName;
  }

  const byDay = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const key = dayKey(row.createdLeadAt);
    const bucket = byDay.get(key) ?? {};
    const cat = categoryOf(row);
    bucket[cat] = (bucket[cat] ?? 0) + 1;
    byDay.set(key, bucket);
  }
  const chartData: ChartPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString(), values: byDay.get(dayKey(d)) ?? {} };
  });

  return { kpi, chartData, series };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ groupBy?: string; days?: string; branch?: string; source?: string }>;
}) {
  const user = await requireRole(...REPORT_ROLES);
  const { groupBy: groupByParam, days: daysParam, branch: branchParam, source: sourceParam } = await searchParams;

  const groupBy = groupByParam === "branch" || groupByParam === "source" ? groupByParam : "status";
  const days = DAYS_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (days - 1));
  windowStart.setHours(0, 0, 0, 0);

  const [branches, sourceRows] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const branchNameByCode = new Map(branches.map((b) => [b.code, b.name]));

  const scope = branchScopeWhere(user);
  const where: Prisma.InteractionWhereInput = {
    ...scope,
    activeFlag: true,
    createdLeadAt: { gte: windowStart },
  };
  if (branchParam && branchParam !== "all" && canAccessBranch(user, branchParam)) {
    where.assignedBranchCode = branchParam;
  }
  if (sourceParam && sourceParam !== "all") {
    where.sourceName = sourceParam;
  }

  const cacheKey = `dash:overview:v1:${JSON.stringify(scope)}:${days}:${branchParam ?? "all"}:${sourceParam ?? "all"}:${groupBy}`;
  const { kpi, chartData, series } = await cached(cacheKey, 90, () =>
    computeDashboardData(where, days, windowStart, groupBy, branchNameByCode)
  );

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Dashboard"
        description="Theo dõi chất lượng nguồn và kết quả chuyển đổi thực tế."
        action={<DashboardFilterBar branches={branches} sources={sourceRows.map((s) => s.name)} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tổng liên hệ" value={kpi.total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đủ tiêu chuẩn" value={kpi.qualified} accentClassName="bg-status-qualified" />
        <KpiCard label="Tiếp nhận" value={kpi.processing} accentClassName="bg-status-received" />
        <KpiCard label="Spam" value={kpi.spam} accentClassName="bg-status-spam" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diễn biến theo thời gian</CardTitle>
          <CardDescription>{days} ngày gần nhất — nhóm theo {groupBy === "branch" ? "cơ sở" : groupBy === "source" ? "nguồn" : "trạng thái"}.</CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardChart data={chartData} series={series} />
        </CardContent>
      </Card>
    </>
  );
}
