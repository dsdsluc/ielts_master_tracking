import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { NewAdIdsView, type NewAdIdRow } from "@/app/(app)/new-ad-ids/new-ad-ids-view";
import { ListPlus } from "lucide-react";

export default async function NewAdIdsPage() {
  await requireRole(ROLES.MARKETING, ROLES.ADMIN);

  const [leadRows, existingCosts, sources, fanpages, branches] = await Promise.all([
    prisma.interaction.findMany({
      where: { adId: { not: null }, activeFlag: true },
      select: { adId: true, sourceName: true, fanpageName: true, assignedBranchCode: true, createdLeadAt: true },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.adsCost.findMany({ select: { adId: true }, distinct: ["adId"] }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true, defaultSourceName: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
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
      byAdId.set(adId, {
        count: 1,
        firstSeenAt: r.createdLeadAt,
        sourceName: r.sourceName,
        fanpageName: r.fanpageName,
        branchCode: r.assignedBranchCode,
      });
    }
  }

  const rows: NewAdIdRow[] = [...byAdId.entries()]
    .map(([adId, b]) => ({
      adId,
      leadCount: b.count,
      firstSeenAt: b.firstSeenAt.toISOString(),
      suggestedSourceName: b.sourceName,
      suggestedFanpageName: b.fanpageName,
      suggestedBranchCode: b.branchCode,
    }))
    .sort((a, b) => b.leadCount - a.leadCount);

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Ad ID mới"
        description='Ad ID xuất hiện trong liên hệ (kể cả nhập từ Excel) nhưng chưa có trong "Chi phí quảng cáo" — điền nốt thông tin còn thiếu.'
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Không có Ad ID mới"
          description="Mọi Ad ID xuất hiện trong liên hệ đều đã có bản ghi chi phí tương ứng."
        />
      ) : (
        <NewAdIdsView
          rows={rows}
          sourceOptions={sources.map((s) => s.name)}
          fanpageOptions={fanpages}
          branchOptions={branches}
        />
      )}
    </>
  );
}
