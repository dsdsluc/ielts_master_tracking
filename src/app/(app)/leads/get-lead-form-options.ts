import "server-only";
import { prisma } from "@/lib/prisma";
import type { LeadFormOptions } from "@/app/(app)/leads/lead-form-options";

/** Danh mục cho form tạo/sửa liên hệ — dùng chung ở leads/page.tsx (dialog
 * tạo mới) và leads/[id]/page.tsx (trang chỉnh sửa). */
export async function getLeadFormOptions(): Promise<LeadFormOptions> {
  const [sources, fanpages, branches, objects, adCosts] = await Promise.all([
    prisma.source.findMany({
      where: { active: true },
      select: { name: true, domains: { select: { domain: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.fanpage.findMany({
      where: { active: true },
      select: { name: true, defaultSourceName: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { active: true },
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.customerObject.findMany({
      where: { active: true },
      select: { name: true },
      orderBy: { sortOrder: "asc" },
    }),
    // 1 Ad ID có thể xuất hiện ở nhiều kỳ chi phí — lấy dòng gần nhất (periodStart
    // mới nhất) cho mỗi Ad ID để gợi ý đúng tên quảng cáo hiện hành.
    prisma.adsCost.findMany({
      distinct: ["adId"],
      orderBy: [{ adId: "asc" }, { periodStart: "desc" }],
      select: { adId: true, adName: true },
      take: 500,
    }),
  ]);

  return {
    sourceDomains: sources.flatMap((s) => s.domains.map((d) => ({ sourceName: s.name, domain: d.domain }))),
    fanpages,
    branches,
    objects: objects.map((o) => o.name),
    adSuggestions: adCosts,
  };
}
