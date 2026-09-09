import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/cache";
import { AdsPerformanceFilterBar } from "@/app/(app)/ads-performance/ads-performance-filter-bar";
import { AdsPerformanceTable, type AdPerfRow } from "@/app/(app)/ads-performance/ads-performance-table";
import { formatVnd } from "@/app/(app)/ads-cost/format";

const DAYS_OPTIONS = [7, 30, 90];

type AdsPerformanceData = { tableRows: AdPerfRow[]; withoutAdIdCount: number; totalLeadsWithAd: number };

// Quét interaction cả cửa sổ ngày + join chi phí quảng cáo theo Ad ID — nặng
// nhất trang, Marketing mở thường xuyên để so hiệu quả quảng cáo. Cache theo
// đúng where-clause thật (branchScopeWhere) làm 1 phần khoá, giống Dashboard
// tổng quan — tự động đúng nếu logic phân quyền chi nhánh đổi sau này.
async function computeAdsPerformanceData(where: Prisma.InteractionWhereInput): Promise<AdsPerformanceData> {
  const rows = await prisma.interaction.findMany({
    where,
    select: { adId: true, statusName: true, sourceName: true, fanpageName: true },
  });

  const withAdId = rows.filter((r) => !!r.adId);
  const withoutAdIdCount = rows.length - withAdId.length;

  type Bucket = { total: number; qualified: number; spam: number; sourceName: string; fanpageName: string };
  const byAd = new Map<string, Bucket>();
  for (const r of withAdId) {
    const adId = r.adId as string;
    const bucket = byAd.get(adId) ?? { total: 0, qualified: 0, spam: 0, sourceName: r.sourceName, fanpageName: r.fanpageName };
    bucket.total++;
    if (r.statusName === STATUS.PHONE) bucket.qualified++;
    if (r.statusName === STATUS.SPAM) bucket.spam++;
    byAd.set(adId, bucket);
  }

  const adIds = [...byAd.keys()];
  const costRows = adIds.length
    ? await prisma.adsCost.findMany({ where: { adId: { in: adIds } }, select: { adId: true, adName: true, costVnd: true } })
    : [];

  const costByAd = new Map<string, { adName: string; totalCost: number }>();
  for (const c of costRows) {
    const existing = costByAd.get(c.adId) ?? { adName: c.adName, totalCost: 0 };
    existing.totalCost += Number(c.costVnd);
    existing.adName = c.adName;
    costByAd.set(c.adId, existing);
  }

  const tableRows: AdPerfRow[] = adIds
    .map((adId) => {
      const b = byAd.get(adId)!;
      const cost = costByAd.get(adId);
      return {
        adId,
        adName: cost?.adName ?? null,
        sourceName: b.sourceName,
        fanpageName: b.fanpageName,
        totalLeads: b.total,
        qualified: b.qualified,
        spam: b.spam,
        conversionRate: b.total > 0 ? (b.qualified / b.total) * 100 : 0,
        totalCost: cost?.totalCost ?? null,
        costPerLead: cost && cost.totalCost > 0 ? cost.totalCost / b.total : null,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);

  return { tableRows, withoutAdIdCount, totalLeadsWithAd: withAdId.length };
}

export default async function AdsPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; branch?: string; source?: string }>;
}) {
  const user = await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { days: daysParam, branch: branchParam, source: sourceParam } = await searchParams;
  const days = DAYS_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (days - 1));
  windowStart.setHours(0, 0, 0, 0);

  const [branches, sourceRows] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

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

  const cacheKey = `ads-perf:v1:${JSON.stringify(scope)}:${days}:${branchParam ?? "all"}:${sourceParam ?? "all"}`;
  const { tableRows, withoutAdIdCount, totalLeadsWithAd } = await cached(cacheKey, 90, () => computeAdsPerformanceData(where));

  const totalQualified = tableRows.reduce((sum, r) => sum + r.qualified, 0);
  const avgConversion = totalLeadsWithAd > 0 ? (totalQualified / totalLeadsWithAd) * 100 : 0;
  const totalCostKnown = tableRows.reduce((sum, r) => sum + (r.totalCost ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Hiệu quả quảng cáo"
        description="Số liên hệ mỗi quảng cáo thu hút được và tỷ lệ chuyển đổi — để biết loại quảng cáo nào đang hiệu quả."
        action={<AdsPerformanceFilterBar branches={branches} sources={sourceRows.map((s) => s.name)} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Quảng cáo có lead" value={tableRows.length} accentClassName="bg-primary" />
        <KpiCard label="Tổng liên hệ (có Ad ID)" value={totalLeadsWithAd} accentClassName="bg-foreground/50" />
        <KpiCard label="Tỷ lệ chuyển đổi TB" value={`${avgConversion.toFixed(1)}%`} accentClassName="bg-status-qualified" />
        <KpiCard label="Tổng chi phí đã ghi nhận" value={formatVnd(totalCostKnown)} accentClassName="bg-status-received" />
      </div>

      {withoutAdIdCount > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Có <strong className="font-mono text-foreground">{withoutAdIdCount}</strong> liên hệ trong khoảng thời gian này không gắn Ad ID
          (nguồn không yêu cầu, hoặc quảng cáo chưa đồng bộ) — không xuất hiện trong bảng dưới.
        </p>
      )}

      <AdsPerformanceTable rows={tableRows} />
    </>
  );
}
