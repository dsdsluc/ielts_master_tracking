import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { AdsCostImportView } from "@/app/(app)/ads-cost/import/ads-cost-import-view";

export default async function AdsCostImportPage() {
  await requireRole(ROLES.MARKETING, ROLES.ADMIN);

  const [sources, fanpages, branches] = await Promise.all([
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true, defaultSourceName: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Nhập chi phí quảng cáo từ Excel"
        description="Tải file Excel danh sách chi phí theo Ad ID, kiểm tra/chỉnh sửa từng dòng trước khi lưu vào hệ thống."
      />
      <AdsCostImportView
        sourceOptions={sources.map((s) => s.name)}
        fanpageOptions={fanpages}
        branchOptions={branches}
      />
    </>
  );
}
