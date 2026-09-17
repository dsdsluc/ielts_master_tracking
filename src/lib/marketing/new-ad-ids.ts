import "server-only";
import { prisma } from "@/lib/prisma";
import type { NewAdIdRow } from "@/app/(app)/new-ad-ids/new-ad-ids-view";

/** Ad ID xuất hiện trong liên hệ (kể cả nhập từ Excel) nhưng chưa có bản ghi
 * "Chi phí quảng cáo" tương ứng — dùng chung ở widget Workspace Marketing,
 * trang /new-ad-ids và trang quản trị /admin/new-ad-ids. */
export async function getNewAdIdRows(): Promise<NewAdIdRow[]> {
  const [leadRows, existingCosts] = await Promise.all([
    prisma.interaction.findMany({
      where: { adId: { not: null }, activeFlag: true },
      select: { adId: true, sourceName: true, fanpageName: true, assignedBranchCode: true, createdLeadAt: true },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.adsCost.findMany({ select: { adId: true }, distinct: ["adId"] }),
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

  return [...byAdId.entries()]
    .map(([adId, b]) => ({
      adId,
      leadCount: b.count,
      firstSeenAt: b.firstSeenAt.toISOString(),
      suggestedSourceName: b.sourceName,
      suggestedFanpageName: b.fanpageName,
      suggestedBranchCode: b.branchCode,
    }))
    .sort((a, b) => b.leadCount - a.leadCount);
}
