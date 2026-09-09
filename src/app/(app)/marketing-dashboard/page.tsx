import Link from "next/link";
import { ArrowRight, CalendarCheck, Megaphone, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import type { CurrentUser } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { isLeaderLike } from "@/lib/interactions/scope";
import { dayKey } from "@/lib/day-key";
import { cached } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { getPageReportRows } from "@/lib/marketing/page-report";
import { DashboardChart, type ChartPoint, type ChartSeries } from "@/app/(app)/dashboard-chart";
import { MarketingDashboardFilterBar } from "@/app/(app)/marketing-dashboard/marketing-dashboard-filter-bar";
import { MiniRankTable, type RankRow } from "@/app/(app)/marketing-dashboard/mini-rank-table";
import { formatVnd } from "@/app/(app)/ads-cost/format";

const DAYS_OPTIONS = [7, 30, 90];
const CHART_SERIES: ChartSeries[] = [
  { key: "total", label: "Tin nhắn nhận được", color: "var(--color-status-received)" },
  { key: "qualified", label: "Khách xin SĐT", color: "var(--color-status-qualified)" },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Marketing/Admin xem toàn bộ chi nhánh trong hầu hết trường hợp thực tế (xem
// seed.ts) — nhưng vẫn tính đúng theo scope thay vì giả định, để 1 tài khoản
// Marketing bị giới hạn 1 chi nhánh không vô tình đọc cache của tài khoản khác.
function scopeCacheKey(user: CurrentUser): string {
  if (isLeaderLike(user) || user.viewAllBranches) return "all";
  return user.branchCode ?? "none";
}

type MarketingDashboardData = {
  totalLeads: number;
  qualified: number;
  totalCost: number;
  chartData: ChartPoint[];
  topPages: RankRow[];
  topAds: RankRow[];
  byAdIdSize: number;
};

// Query interactions cả cửa sổ (tới 90 ngày) + tổng hợp theo ngày/Page/quảng
// cáo trong JS — phần nặng nhất của trang, nhiều Marketing/Admin cùng mở mỗi
// ngày nhưng dữ liệu không cần chính xác tới từng giây, nên cache lại.
async function computeMarketingDashboardData(
  user: CurrentUser,
  days: number,
  windowStart: Date,
  windowEnd: Date
): Promise<MarketingDashboardData> {
  const [rows, costRows] = await Promise.all([
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(user), activeFlag: true, createdLeadAt: { gte: windowStart } },
      select: { createdLeadAt: true, statusName: true, fanpageName: true, adId: true },
    }),
    prisma.adsCost.findMany({
      where: { periodStart: { lte: windowEnd }, periodEnd: { gte: windowStart } },
      select: { costVnd: true },
    }),
  ]);

  const totalLeads = rows.length;
  const qualified = rows.filter((r) => r.statusName === STATUS.PHONE).length;
  const totalCost = costRows.reduce((sum, c) => sum + Number(c.costVnd), 0);

  const byDay = new Map<string, { total: number; qualified: number }>();
  for (const r of rows) {
    const key = dayKey(r.createdLeadAt);
    const bucket = byDay.get(key) ?? { total: 0, qualified: 0 };
    bucket.total++;
    if (r.statusName === STATUS.PHONE) bucket.qualified++;
    byDay.set(key, bucket);
  }
  const chartData: ChartPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    const bucket = byDay.get(dayKey(d)) ?? { total: 0, qualified: 0 };
    return { date: d.toISOString(), values: bucket };
  });

  const byFanpage = new Map<string, { total: number; qualified: number }>();
  const byAdId = new Map<string, { total: number; qualified: number }>();
  for (const r of rows) {
    const fp = byFanpage.get(r.fanpageName) ?? { total: 0, qualified: 0 };
    fp.total++;
    if (r.statusName === STATUS.PHONE) fp.qualified++;
    byFanpage.set(r.fanpageName, fp);

    if (r.adId) {
      const ad = byAdId.get(r.adId) ?? { total: 0, qualified: 0 };
      ad.total++;
      if (r.statusName === STATUS.PHONE) ad.qualified++;
      byAdId.set(r.adId, ad);
    }
  }

  const topPages: RankRow[] = [...byFanpage.entries()]
    .map(([key, v]) => ({ key, label: key, total: v.total, qualified: v.qualified }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topAds: RankRow[] = [...byAdId.entries()]
    .map(([key, v]) => ({ key, label: key, sub: undefined, total: v.total, qualified: v.qualified }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return { totalLeads, qualified, totalCost, chartData, topPages, topAds, byAdIdSize: byAdId.size };
}

export default async function MarketingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { days: daysParam } = await searchParams;
  const days = DAYS_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (days - 1));
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date();
  windowEnd.setHours(23, 59, 59, 999);

  const [{ totalLeads, qualified, totalCost, chartData, topPages, topAds, byAdIdSize }, todayRows, pendingFollowup, totalAdsCostRecords] =
    await Promise.all([
      cached(`dash:marketing:v1:${scopeCacheKey(user)}:${days}`, 90, () =>
        computeMarketingDashboardData(user, days, windowStart, windowEnd)
      ),
      getPageReportRows(todayStr()),
      prisma.interaction.count({ where: { ...branchScopeWhere(user), activeFlag: true, needsFollowup: true } }),
      prisma.adsCost.count(),
    ]);

  const conversionRate = totalLeads > 0 ? (qualified / totalLeads) * 100 : 0;
  const costPerLead = totalCost > 0 && totalLeads > 0 ? totalCost / totalLeads : null;
  const todayClosed = todayRows.filter((r) => r.closed).length;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Dashboard Marketing"
        description="Tổng quan hiệu quả marketing — liên hệ, chi phí, Page, quảng cáo, chăm sóc lại."
        action={<MarketingDashboardFilterBar />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tổng liên hệ" value={totalLeads} accentClassName="bg-foreground/50" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${conversionRate.toFixed(1)}%`} accentClassName="bg-status-qualified" />
        <KpiCard label="Chi phí quảng cáo" value={formatVnd(totalCost)} accentClassName="bg-status-received" />
        <KpiCard label="CP/liên hệ" value={costPerLead != null ? formatVnd(Math.round(costPerLead)) : "—"} accentClassName="bg-primary" />
      </div>

      <Card className="mb-6 gap-0 py-0">
        <CardHeader className="border-b border-border/70 px-5 py-3.5">
          <CardTitle>Diễn biến theo ngày</CardTitle>
          <CardDescription>{days} ngày gần nhất — Tin nhắn nhận được và Khách xin SĐT.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <DashboardChart data={chartData} series={CHART_SERIES} />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <MiniRankTable
          title="Top Page"
          rows={topPages}
          viewAllHref="/page-report"
          emptyIcon={CalendarCheck}
          emptyText="Chưa có liên hệ nào trong khoảng thời gian này."
        />
        <MiniRankTable
          title="Top quảng cáo"
          rows={topAds}
          viewAllHref="/ads-performance"
          emptyIcon={TrendingUp}
          emptyText="Chưa có liên hệ nào gắn Ad ID trong khoảng thời gian này."
          rowHref={(key) => `/ads-performance/${encodeURIComponent(key)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/ads-cost" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Megaphone className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Chi phí quảng cáo</p>
              <p className="text-xs text-muted-foreground">{totalAdsCostRecords} bản ghi</p>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        <Link href="/ads-performance" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <TrendingUp className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Hiệu quả quảng cáo</p>
              <p className="text-xs text-muted-foreground">{byAdIdSize} quảng cáo có lead</p>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        <Link href="/page-report" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <CalendarCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Báo cáo Page hôm nay</p>
              <p className="text-xs text-muted-foreground">
                {todayClosed}/{todayRows.length} Page đã chốt
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        <Link href="/followup-tracking" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Chăm sóc lại</p>
              <p className="text-xs text-muted-foreground">{pendingFollowup} đang chờ Sale xử lý</p>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </>
  );
}
