import Link from "next/link";
import { ArrowRight, CalendarCheck, FileSpreadsheet, ListPlus, Megaphone, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { prisma } from "@/lib/prisma";
import { getPageReportRows } from "@/lib/marketing/page-report";
import { PageReportTable } from "@/app/(app)/page-report/page-report-table";
import { AdsCostDialog } from "@/app/(app)/ads-cost/ads-cost-dialog";
import { NewAdIdsView, type NewAdIdRow } from "@/app/(app)/new-ad-ids/new-ad-ids-view";
import { MiniRankTable, type RankRow } from "@/app/(app)/marketing-dashboard/mini-rank-table";
import { formatDate, formatVnd } from "@/app/(app)/ads-cost/format";

const PERF_WINDOW_DAYS = 7;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MarketingWorkspacePage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "marketingWorkspace");
  const today = todayStr();
  const canClose = user.role === ROLES.ADMIN || user.canCloseMktReport;

  const perfWindowStart = new Date();
  perfWindowStart.setDate(perfWindowStart.getDate() - (PERF_WINDOW_DAYS - 1));
  perfWindowStart.setHours(0, 0, 0, 0);
  const perfWindowEnd = new Date();
  perfWindowEnd.setHours(23, 59, 59, 999);

  const [pageReportRows, leadRows, existingCosts, totalCostAgg, sources, fanpages, branches, recentCosts, perfLeadRows, perfCostRows] =
    await Promise.all([
      getPageReportRows(today),
      // "Ad ID mới" = Ad ID xuất hiện trong liên hệ nhưng chưa có bản ghi chi phí
      // tương ứng — mirror new-ad-ids/page.tsx.
      prisma.interaction.findMany({
        where: { adId: { not: null }, activeFlag: true },
        select: { adId: true, sourceName: true, fanpageName: true, assignedBranchCode: true, createdLeadAt: true },
        orderBy: { createdLeadAt: "asc" },
      }),
      prisma.adsCost.findMany({ select: { adId: true }, distinct: ["adId"] }),
      prisma.adsCost.aggregate({ _sum: { costVnd: true } }),
      prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
      prisma.fanpage.findMany({ where: { active: true }, select: { name: true, defaultSourceName: true }, orderBy: { name: "asc" } }),
      prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
      // 5 chi phí ghi nhận gần đây nhất — cho thấy ngay có vừa nhập gì chưa,
      // khỏi phải mở /ads-cost mới biết.
      prisma.adsCost.findMany({ orderBy: [{ periodStart: "desc" }, { id: "desc" }], take: 5 }),
      // Hiệu quả quảng cáo — CP/liên hệ theo Ad ID trong PERF_WINDOW_DAYS ngày
      // gần nhất, mirror computeAdsPerformanceData() ở /ads-performance nhưng
      // thu gọn cho "hôm nay/gần đây" thay vì cho phép chọn khoảng ngày tuỳ ý.
      prisma.interaction.findMany({
        where: { ...branchScopeWhere(user), activeFlag: true, adId: { not: null }, createdLeadAt: { gte: perfWindowStart, lte: perfWindowEnd } },
        select: { adId: true, statusName: true },
      }),
      prisma.adsCost.findMany({
        where: { periodStart: { lte: perfWindowEnd }, periodEnd: { gte: perfWindowStart } },
        select: { adId: true, adName: true, costVnd: true },
      }),
    ]);

  const existingAdIds = new Set(existingCosts.map((c) => c.adId));
  type Bucket = { count: number; firstSeenAt: Date; sourceName: string; fanpageName: string; branchCode: string };
  const byAdId = new Map<string, Bucket>();
  for (const r of leadRows) {
    const adId = r.adId as string;
    if (existingAdIds.has(adId)) continue;
    const existing = byAdId.get(adId);
    if (existing) {
      existing.count++;
    } else {
      byAdId.set(adId, { count: 1, firstSeenAt: r.createdLeadAt, sourceName: r.sourceName, fanpageName: r.fanpageName, branchCode: r.assignedBranchCode });
    }
  }
  const newAdIdRows: NewAdIdRow[] = [...byAdId.entries()]
    .map(([adId, b]) => ({
      adId,
      leadCount: b.count,
      firstSeenAt: b.firstSeenAt.toISOString(),
      suggestedSourceName: b.sourceName,
      suggestedFanpageName: b.fanpageName,
      suggestedBranchCode: b.branchCode,
    }))
    .sort((a, b) => b.leadCount - a.leadCount);

  // Quảng cáo hiệu quả nhất trong PERF_WINDOW_DAYS ngày — chỉ xét quảng cáo
  // ĐÃ có chi phí ghi nhận (mới tính được CP/liên hệ), sắp theo CPL thấp nhất
  // trước — góc nhìn "hiệu quả" bổ sung cho Dashboard Marketing (nơi xếp hạng
  // theo số lượng liên hệ, không theo chi phí).
  const perfLeadsByAdId = new Map<string, { total: number; qualified: number }>();
  for (const r of perfLeadRows) {
    const adId = r.adId as string;
    const bucket = perfLeadsByAdId.get(adId) ?? { total: 0, qualified: 0 };
    bucket.total++;
    if (r.statusName === STATUS.PHONE) bucket.qualified++;
    perfLeadsByAdId.set(adId, bucket);
  }
  const perfCostByAdId = new Map<string, { cost: number; adName: string }>();
  for (const c of perfCostRows) {
    const bucket = perfCostByAdId.get(c.adId) ?? { cost: 0, adName: c.adName };
    bucket.cost += Number(c.costVnd);
    perfCostByAdId.set(c.adId, bucket);
  }
  const efficientAdRows: RankRow[] = [...perfLeadsByAdId.entries()]
    .map(([adId, v]) => {
      const costInfo = perfCostByAdId.get(adId);
      const cost = costInfo?.cost ?? 0;
      const costPerLead = cost > 0 && v.total > 0 ? cost / v.total : null;
      return { key: adId, label: costInfo?.adName ?? adId, sub: adId, total: v.total, qualified: v.qualified, costPerLead };
    })
    .filter((r): r is typeof r & { costPerLead: number } => r.costPerLead != null)
    .sort((a, b) => a.costPerLead - b.costPerLead)
    .slice(0, 5)
    .map((r) => ({ key: r.key, label: r.label, sub: `${r.sub} · CP/liên hệ ${formatVnd(Math.round(r.costPerLead))}`, total: r.total, qualified: r.qualified }));

  const avgCostPerLead = (() => {
    const withCost = [...perfLeadsByAdId.entries()].filter(([adId]) => (perfCostByAdId.get(adId)?.cost ?? 0) > 0);
    const totalCostWindow = withCost.reduce((sum, [adId]) => sum + (perfCostByAdId.get(adId)?.cost ?? 0), 0);
    const totalLeadsWindow = withCost.reduce((sum, [, v]) => sum + v.total, 0);
    return totalLeadsWindow > 0 ? totalCostWindow / totalLeadsWindow : null;
  })();

  const closedCount = pageReportRows.filter((r) => r.closed).length;
  const sourceOptions = sources.map((s) => s.name);
  const fanpageNameOptions = fanpages.map((f) => f.name);
  const totalCost = totalCostAgg._sum.costVnd?.toString() ?? "0";

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Workspace Marketing"
        description="Trung tâm xử lý hằng ngày — chốt báo cáo Page, quản lý chi phí quảng cáo, theo dõi hiệu quả và xử lý Ad ID mới phát hiện."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Page đã chốt hôm nay" value={`${closedCount}/${pageReportRows.length}`} accentClassName="bg-status-received" />
        <KpiCard label="Ad ID mới cần xử lý" value={newAdIdRows.length} accentClassName="bg-status-waiting" />
        <KpiCard label="Tổng chi phí quảng cáo" value={formatVnd(totalCost)} accentClassName="bg-primary" />
        <KpiCard
          label={`CP/liên hệ (${PERF_WINDOW_DAYS} ngày)`}
          value={avgCostPerLead != null ? formatVnd(Math.round(avgCostPerLead)) : "—"}
          accentClassName="bg-status-qualified"
        />
      </div>

      <Card className="mb-6">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-1.5">
            <CalendarCheck className="size-4 text-status-received" /> Báo cáo Page hằng ngày — hôm nay
          </CardTitle>
          <CardDescription>Chốt để giữ nguyên số liệu trong ngày. Xem ngày khác hoặc lịch sử tại trang đầy đủ.</CardDescription>
          <CardAction>
            <Link href="/page-report" className="inline-flex items-center gap-1 text-xs font-medium text-status-received hover:underline">
              Xem đầy đủ <ArrowRight className="size-3.5" />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!canClose && (
            <p className="mb-3 text-xs text-muted-foreground">
              Bạn chỉ có thể xem — chưa được cấp quyền chốt báo cáo (liên hệ Quản trị hệ thống ở trang Người dùng nếu cần).
            </p>
          )}
          {pageReportRows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Chưa có Page nào" description="Thêm Page đang hoạt động ở trang Fanpage để bắt đầu theo dõi." />
          ) : (
            <PageReportTable rows={pageReportRows} date={today} canClose={canClose} isAdmin={user.role === ROLES.ADMIN} />
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-1.5">
            <Megaphone className="size-4 text-primary" /> Chi phí quảng cáo
          </CardTitle>
          <CardDescription>Ghi nhận chi phí mới theo Ad ID, hoặc nhập cả kỳ báo cáo từ Excel.</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Link
                href="/ads-cost/import"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/60"
              >
                <FileSpreadsheet className="size-3.5" /> Nhập từ Excel
              </Link>
              <AdsCostDialog mode="create" sourceOptions={sourceOptions} fanpageOptions={fanpageNameOptions} branchOptions={branches} />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recentCosts.length === 0 ? (
            <EmptyState icon={Megaphone} title="Chưa có chi phí nào" description="Ghi nhận chi phí đầu tiên để bắt đầu theo dõi CP/liên hệ." />
          ) : (
            <div className="flex flex-col">
              {recentCosts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground" title={c.adName}>{c.adName}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground" title={c.adId}>{c.adId}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono font-medium text-foreground">{formatVnd(c.costVnd.toString())}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(c.periodStart.toISOString())} – {formatDate(c.periodEnd.toISOString())}
                    </p>
                  </div>
                </div>
              ))}
              <Link href="/ads-cost" className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline">
                Xem tất cả chi phí <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-6">
        <MiniRankTable
          title={`Hiệu quả quảng cáo — ${PERF_WINDOW_DAYS} ngày qua (CP/liên hệ thấp nhất)`}
          rows={efficientAdRows}
          viewAllHref="/ads-performance"
          rowHref={(key) => `/ads-performance/${encodeURIComponent(key)}`}
          emptyIcon={TrendingUp}
          emptyText="Cần có cả liên hệ gắn Ad ID lẫn chi phí ghi nhận trong khoảng thời gian này mới tính được CP/liên hệ."
        />
      </div>

      <div className="mb-2.5 flex items-center gap-2.5">
        <ListPlus className="size-4 text-status-waiting" />
        <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Ad ID mới</h2>
      </div>
      <NewAdIdsView rows={newAdIdRows} sourceOptions={sourceOptions} fanpageOptions={fanpages} branchOptions={branches} />
    </>
  );
}
