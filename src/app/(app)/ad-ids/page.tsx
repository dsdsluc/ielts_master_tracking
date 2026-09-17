import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { STATUS } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { formatVnd } from "@/app/(app)/ads-cost/format";
import { AdIdRegistryView, type AdIdRegistryRow } from "@/app/(app)/ad-ids/ad-id-registry-view";

// "Sổ đăng ký" Ad ID — TOÀN THỜI GIAN, khác với /ads-performance (xếp hạng
// hiệu quả trong 1 khoảng ngày) và /ads-cost (danh sách bản ghi chi phí thô).
// Chỉ liệt kê Ad ID ĐÃ có chi phí — PHÁT HIỆN Ad ID mới (chưa nhập chi phí)
// đã tách hẳn sang trang quản trị /admin/new-ad-ids, trang này chỉ còn đúng
// việc THEO DÕI hiệu quả Ad ID đã đăng ký, đúng vai Marketing hơn.
export default async function AdIdsPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user.role, "adIds");

  const [leadRows, costRows] = await Promise.all([
    prisma.interaction.findMany({
      where: { activeFlag: true, adId: { not: null } },
      select: { adId: true, statusName: true, sourceName: true, fanpageName: true, createdLeadAt: true },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.adsCost.findMany({ select: { adId: true, adName: true, costVnd: true } }),
  ]);

  type LeadBucket = { total: number; qualified: number; sourceName: string; fanpageName: string; firstSeenAt: Date };
  const byAdId = new Map<string, LeadBucket>();
  for (const r of leadRows) {
    const adId = r.adId as string;
    const bucket = byAdId.get(adId);
    if (bucket) {
      bucket.total++;
      if (r.statusName === STATUS.PHONE) bucket.qualified++;
    } else {
      byAdId.set(adId, {
        total: 1,
        qualified: r.statusName === STATUS.PHONE ? 1 : 0,
        sourceName: r.sourceName,
        fanpageName: r.fanpageName,
        firstSeenAt: r.createdLeadAt,
      });
    }
  }

  const costByAdId = new Map<string, { adName: string; totalCost: number }>();
  for (const c of costRows) {
    const existing = costByAdId.get(c.adId) ?? { adName: c.adName, totalCost: 0 };
    existing.totalCost += Number(c.costVnd);
    existing.adName = c.adName;
    costByAdId.set(c.adId, existing);
  }

  // Chỉ Ad ID ĐÃ có chi phí — Ad ID chỉ xuất hiện trong liên hệ (byAdId) mà
  // chưa có cost record thì thuộc phạm vi /admin/new-ad-ids, không liệt kê ở đây.
  const rows: AdIdRegistryRow[] = [...costByAdId.entries()]
    .map(([adId, cost]) => {
      const lead = byAdId.get(adId);
      return {
        adId,
        adName: cost.adName,
        sourceName: lead?.sourceName ?? null,
        fanpageName: lead?.fanpageName ?? null,
        firstSeenAt: lead?.firstSeenAt.toISOString() ?? null,
        totalLeads: lead?.total ?? 0,
        qualified: lead?.qualified ?? 0,
        totalCost: cost.totalCost,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);

  const totalCostAll = rows.reduce((sum, r) => sum + r.totalCost, 0);
  const rowsForAvg = rows.filter((r) => r.totalCost > 0 && r.totalLeads > 0);
  const avgCostPerLead =
    rowsForAvg.length > 0
      ? rowsForAvg.reduce((sum, r) => sum + r.totalCost, 0) / rowsForAvg.reduce((sum, r) => sum + r.totalLeads, 0)
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Ad ID"
        description="Ad ID đã đăng ký chi phí — theo dõi hiệu quả từng quảng cáo. Ad ID mới chưa nhập chi phí được xử lý riêng ở mục Quản trị."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Tổng Ad ID" value={rows.length} accentClassName="bg-foreground/50" />
        <KpiCard label="Tổng chi phí" value={formatVnd(totalCostAll)} accentClassName="bg-primary" />
        <KpiCard
          label="CP/liên hệ trung bình"
          value={avgCostPerLead != null ? formatVnd(Math.round(avgCostPerLead)) : "—"}
          accentClassName="bg-status-qualified"
        />
      </div>

      <AdIdRegistryView rows={rows} />
    </>
  );
}
