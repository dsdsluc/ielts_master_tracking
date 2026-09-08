import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { AdsCostDialog } from "@/app/(app)/ads-cost/ads-cost-dialog";
import { AdsCostFilterBar } from "@/app/(app)/ads-cost/ads-cost-filter-bar";
import { AdsCostTable } from "@/app/(app)/ads-cost/ads-cost-table";
import { formatVnd } from "@/app/(app)/ads-cost/format";

export default async function AdsCostPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; branch?: string }>;
}) {
  await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { q, source, branch } = await searchParams;

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

  const [adsCosts, totalAgg, sources, fanpages, branches] = await Promise.all([
    prisma.adsCost.findMany({ where, orderBy: [{ periodStart: "desc" }, { id: "desc" }] }),
    prisma.adsCost.aggregate({ where, _sum: { costVnd: true } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);

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
  const hasFilters = !!q?.trim() || (!!source && source !== "all") || (!!branch && branch !== "all");
  const totalCost = totalAgg._sum.costVnd?.toString() ?? "0";

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
        <AdsCostFilterBar sourceOptions={sources.map((s) => s.name)} branchOptions={branches} />
      </div>

      <AdsCostTable
        rows={rows}
        branchNames={branchNames}
        sourceOptions={sources.map((s) => s.name)}
        fanpageOptions={fanpages.map((f) => f.name)}
        branchOptions={branches}
        hasFilters={hasFilters}
      />
    </>
  );
}
