import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { AdLeadsTable } from "@/app/(app)/ads-performance/[adId]/ad-leads-table";
import { formatVnd } from "@/app/(app)/ads-cost/format";

export default async function AdPerformanceDetailPage({
  params,
}: {
  params: Promise<{ adId: string }>;
}) {
  const user = await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { adId: rawAdId } = await params;
  const adId = decodeURIComponent(rawAdId);

  const [branches, costRows, leadRows] = await Promise.all([
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.adsCost.findMany({ where: { adId }, orderBy: { periodStart: "desc" } }),
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(user), activeFlag: true, adId },
      include: listItemInclude,
      orderBy: { createdLeadAt: "desc" },
    }),
  ]);

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const items = leadRows.map(toListItem);

  if (items.length === 0 && costRows.length === 0) {
    return (
      <>
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/ads-performance" />} aria-label="Quay lại Hiệu quả quảng cáo">
            <ArrowLeft className="size-4" />
          </Button>
          <span className="font-heading text-xl font-semibold text-foreground">{adId}</span>
        </div>
        <EmptyState
          icon={Megaphone}
          title="Không có dữ liệu cho Ad ID này"
          description="Chưa có liên hệ hay chi phí nào ghi nhận với Ad ID này."
        />
      </>
    );
  }

  const totalLeads = items.length;
  const qualified = items.filter((i) => i.status === STATUS.PHONE).length;
  const spam = items.filter((i) => i.status === STATUS.SPAM).length;
  const conversionRate = totalLeads > 0 ? (qualified / totalLeads) * 100 : 0;
  const totalCost = costRows.reduce((sum, c) => sum + Number(c.costVnd), 0);
  const costPerLead = totalCost > 0 && totalLeads > 0 ? totalCost / totalLeads : null;
  const costPerQualified = totalCost > 0 && qualified > 0 ? totalCost / qualified : null;

  const adName = costRows[0]?.adName ?? null;
  const sourceName = items[0]?.sourceName ?? costRows[0]?.sourceName ?? null;
  const fanpageName = items[0]?.fanpageName ?? costRows[0]?.fanpageName ?? null;

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/ads-performance" />} aria-label="Quay lại Hiệu quả quảng cáo">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Marketing · Hiệu quả quảng cáo</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-foreground">{adName ?? adId}</h1>
            {sourceName && (
              <span className="rounded-full bg-status-received-bg px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-status-received uppercase">
                {sourceName}
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Ad ID: {adId}
            {fanpageName ? ` · ${fanpageName}` : ""}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tổng liên hệ" value={totalLeads} accentClassName="bg-foreground/50" />
        <KpiCard label="Đủ tiêu chuẩn" value={qualified} accentClassName="bg-status-qualified" />
        <KpiCard label="Spam" value={spam} accentClassName="bg-status-spam" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${conversionRate.toFixed(1)}%`} accentClassName="bg-primary" />
        <KpiCard label="Tổng chi phí" value={formatVnd(totalCost)} accentClassName="bg-status-received" />
        <KpiCard label="CP/liên hệ" value={costPerLead != null ? formatVnd(Math.round(costPerLead)) : "—"} accentClassName="bg-accent" />
        <KpiCard label="CP/liên hệ đủ tiêu chuẩn" value={costPerQualified != null ? formatVnd(Math.round(costPerQualified)) : "—"} accentClassName="bg-accent" />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Danh sách liên hệ</h2>
      <AdLeadsTable items={items} branchNames={branchNames} />
    </>
  );
}
