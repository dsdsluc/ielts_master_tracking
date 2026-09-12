import { FileDown } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { isAdsCostCleanupEnabled } from "@/lib/interactions/settings";
import { AdsCostDialog } from "@/app/(app)/ads-cost/ads-cost-dialog";
import { AdsCostFilterBar } from "@/app/(app)/ads-cost/ads-cost-filter-bar";
import { AdsCostTable } from "@/app/(app)/ads-cost/ads-cost-table";
import { formatVnd } from "@/app/(app)/ads-cost/format";

export default async function AdsCostPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; branch?: string; period?: string; costMin?: string; costMax?: string }>;
}) {
  await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { q, source, branch, period, costMin, costMax } = await searchParams;

  const where: Prisma.AdsCostWhereInput = {};
  if (source && source !== "all") where.sourceName = source;
  if (branch && branch !== "all") where.branchCode = branch;
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { adId: { contains: term, mode: "insensitive" } },
      { adName: { contains: term, mode: "insensitive" } },
    ];
  }
  // "period" mã hoá "periodStartISO_periodEndISO" — khớp đúng 1 kỳ báo cáo cụ
  // thể, vì dữ liệu luôn nhập theo từng đợt (vd. mỗi tuần 1 kỳ) chứ không phải
  // ngày lẻ, nên chọn đúng theo cặp ngày có sẵn dễ dùng hơn range tự do.
  if (period) {
    const [start, end] = period.split("_");
    if (start && end) {
      where.periodStart = new Date(start);
      where.periodEnd = new Date(end);
    }
  }
  const costMinNum = costMin ? Number(costMin) : undefined;
  const costMaxNum = costMax ? Number(costMax) : undefined;
  if (costMinNum !== undefined || costMaxNum !== undefined) {
    where.costVnd = {};
    if (costMinNum !== undefined && !Number.isNaN(costMinNum)) where.costVnd.gte = costMinNum;
    if (costMaxNum !== undefined && !Number.isNaN(costMaxNum)) where.costVnd.lte = costMaxNum;
  }

  const [adsCosts, totalAgg, sources, fanpages, branches, cleanupEnabled, periodRows] = await Promise.all([
    prisma.adsCost.findMany({ where, orderBy: [{ periodStart: "desc" }, { id: "desc" }] }),
    prisma.adsCost.aggregate({ where, _sum: { costVnd: true } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    isAdsCostCleanupEnabled(),
    // Danh sách kỳ báo cáo có sẵn — luôn lấy TOÀN BỘ (không áp where hiện tại)
    // để bộ lọc kỳ không tự thu hẹp theo chính nó.
    prisma.adsCost.findMany({
      distinct: ["periodStart", "periodEnd"],
      select: { periodStart: true, periodEnd: true },
      orderBy: { periodStart: "desc" },
    }),
  ]);
  const periodOptions = periodRows.map((p) => ({
    value: `${p.periodStart.toISOString()}_${p.periodEnd.toISOString()}`,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
  }));

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const rows = adsCosts.map((c) => ({
    id: c.id,
    periodStart: c.periodStart.toISOString(),
    periodEnd: c.periodEnd.toISOString(),
    adId: c.adId,
    adName: c.adName,
    sourceName: c.sourceName,
    fanpageName: c.fanpageName,
    branchCode: c.branchCode,
    costVnd: c.costVnd.toString(),
    note: c.note,
  }));
  const hasFilters =
    !!q?.trim() || (!!source && source !== "all") || (!!branch && branch !== "all") || !!period || !!costMin || !!costMax;
  const totalCost = totalAgg._sum.costVnd?.toString() ?? "0";

  const exportParams = new URLSearchParams();
  if (q?.trim()) exportParams.set("q", q.trim());
  if (source && source !== "all") exportParams.set("source", source);
  if (branch && branch !== "all") exportParams.set("branch", branch);
  if (period) exportParams.set("period", period);
  if (costMin) exportParams.set("costMin", costMin);
  if (costMax) exportParams.set("costMax", costMax);
  const exportHref = `/api/ads-cost/export?${exportParams.toString()}`;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Chi phí quảng cáo"
        description="Chi phí theo Ad ID từng kỳ báo cáo — dùng để tính CP/liên hệ trên Dashboard."
        action={
          <AdsCostDialog
            mode="create"
            sourceOptions={sources.map((s) => s.name)}
            fanpageOptions={fanpages.map((f) => f.name)}
            branchOptions={branches}
          />
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard label={hasFilters ? "Tổng chi phí (đã lọc)" : "Tổng chi phí"} value={formatVnd(totalCost)} accentClassName="bg-primary" />
          <KpiCard label="Số bản ghi" value={rows.length} accentClassName="bg-foreground/50" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdsCostFilterBar sourceOptions={sources.map((s) => s.name)} branchOptions={branches} />
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-full"
            nativeButton={false}
            render={<a href={exportHref} />}
          >
            <FileDown className="size-3.5" />
            Xuất Excel
          </Button>
        </div>
      </div>

      <AdsCostTable
        rows={rows}
        branchNames={branchNames}
        sourceOptions={sources.map((s) => s.name)}
        fanpageOptions={fanpages.map((f) => f.name)}
        branchOptions={branches}
        hasFilters={hasFilters}
        cleanupEnabled={cleanupEnabled}
        periodOptions={periodOptions}
        currentPeriod={period ?? "all"}
        currentCostMin={costMin ?? ""}
        currentCostMax={costMax ?? ""}
      />
    </>
  );
}
