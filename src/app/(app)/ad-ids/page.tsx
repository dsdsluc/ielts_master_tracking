import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { formatVnd } from "@/app/(app)/ads-cost/format";
import { AdIdRegistryView, type AdIdRegistryRow } from "@/app/(app)/ad-ids/ad-id-registry-view";

// "Sổ đăng ký" Ad ID — TOÀN THỜI GIAN, khác với /ads-performance (xếp hạng
// hiệu quả trong 1 khoảng ngày) và /ads-cost (danh sách bản ghi chi phí thô).
// Đây là nơi duy nhất gộp đủ 3 việc: PHÁT HIỆN Ad ID chưa có chi phí (badge
// "Chưa có" + bộ lọc), QUẢN LÝ (thêm chi phí ngay tại dòng qua AdsCostDialog),
// và THỐNG KÊ (số liên hệ/tỷ lệ chuyển đổi/CP mỗi liên hệ) — mỗi dòng link
// sang /ads-performance/[adId] đã có sẵn để xem sâu (không lặp lại UI đó ở đây).
export default async function AdIdsPage() {
  const user = await requireRole(ROLES.MARKETING, ROLES.ADMIN);

  const [leadRows, costRows, sources, fanpages, branches] = await Promise.all([
    prisma.interaction.findMany({
      where: { activeFlag: true, adId: { not: null } },
      select: { adId: true, statusName: true, sourceName: true, fanpageName: true, createdLeadAt: true },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.adsCost.findMany({ select: { adId: true, adName: true, costVnd: true } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
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

  const allAdIds = new Set([...byAdId.keys(), ...costByAdId.keys()]);
  const rows: AdIdRegistryRow[] = [...allAdIds]
    .map((adId) => {
      const lead = byAdId.get(adId);
      const cost = costByAdId.get(adId);
      return {
        adId,
        adName: cost?.adName ?? null,
        sourceName: lead?.sourceName ?? null,
        fanpageName: lead?.fanpageName ?? null,
        firstSeenAt: lead?.firstSeenAt.toISOString() ?? null,
        totalLeads: lead?.total ?? 0,
        qualified: lead?.qualified ?? 0,
        totalCost: cost?.totalCost ?? null,
      };
    })
    // Chưa có chi phí lên đầu — đây là việc cần xử lý (phát hiện); trong mỗi
    // nhóm sắp theo số liên hệ giảm dần để thấy quảng cáo đáng chú ý nhất trước.
    .sort((a, b) => {
      const aMissing = a.totalCost == null ? 0 : 1;
      const bMissing = b.totalCost == null ? 0 : 1;
      if (aMissing !== bMissing) return aMissing - bMissing;
      return b.totalLeads - a.totalLeads;
    });

  const missingCostCount = rows.filter((r) => r.totalCost == null).length;
  const totalCostAll = rows.reduce((sum, r) => sum + (r.totalCost ?? 0), 0);
  const rowsForAvg = rows.filter((r) => r.totalCost != null && r.totalCost > 0 && r.totalLeads > 0);
  const avgCostPerLead =
    rowsForAvg.length > 0
      ? rowsForAvg.reduce((sum, r) => sum + r.totalCost!, 0) / rowsForAvg.reduce((sum, r) => sum + r.totalLeads, 0)
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Ad ID"
        description="Toàn bộ Ad ID hệ thống từng ghi nhận — quản lý chi phí, phát hiện Ad ID mới chưa nhập, và thống kê hiệu quả từng quảng cáo."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tổng Ad ID" value={rows.length} accentClassName="bg-foreground/50" />
        <KpiCard label="Chưa có chi phí" value={missingCostCount} accentClassName="bg-status-waiting" />
        <KpiCard label="Tổng chi phí" value={formatVnd(totalCostAll)} accentClassName="bg-primary" />
        <KpiCard
          label="CP/liên hệ trung bình"
          value={avgCostPerLead != null ? formatVnd(Math.round(avgCostPerLead)) : "—"}
          accentClassName="bg-status-qualified"
        />
      </div>

      <AdIdRegistryView
        rows={rows}
        sourceOptions={sources.map((s) => s.name)}
        fanpageOptions={fanpages.map((f) => f.name)}
        branchOptions={branches}
      />
    </>
  );
}
