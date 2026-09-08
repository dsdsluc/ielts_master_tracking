import "server-only";
import { prisma } from "@/lib/prisma";
import type { LeadFormOptions } from "@/app/(app)/leads/lead-form-options";

/** Danh mục cho form tạo/sửa liên hệ — dùng chung ở leads/page.tsx (dialog
 * tạo mới) và leads/[id]/page.tsx (trang chỉnh sửa). */
export async function getLeadFormOptions(): Promise<LeadFormOptions> {
  const [sources, fanpages, branches, objects] = await Promise.all([
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
  ]);

  return {
    sourceDomains: sources.flatMap((s) => s.domains.map((d) => ({ sourceName: s.name, domain: d.domain }))),
    fanpages,
    branches,
    objects: objects.map((o) => o.name),
  };
}
