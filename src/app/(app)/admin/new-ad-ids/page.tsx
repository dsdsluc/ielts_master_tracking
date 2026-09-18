import Link from "next/link";
import { FileSpreadsheet, ListPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { prisma } from "@/lib/prisma";
import { getNewAdIdRows } from "@/lib/marketing/new-ad-ids";
import { AdminNewAdIdsView } from "@/app/(app)/admin/new-ad-ids/admin-new-ad-ids-view";

export default async function AdminNewAdIdsPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "newAdIds");

  const [rows, sources, fanpages, branches] = await Promise.all([
    getNewAdIdRows(),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Ad ID mới"
        description='Ad ID xuất hiện trong liên hệ nhưng chưa có bản ghi "Chi phí quảng cáo" tương ứng — bấm vào từng dòng để điền nốt thông tin.'
        action={
          <Button variant="outline" size="sm" className="h-10 rounded-full" nativeButton={false} render={<Link href="/ads-cost/import" />}>
            <FileSpreadsheet className="size-3.5" /> Nhập hàng loạt từ Excel
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Không có Ad ID mới"
          description="Mọi Ad ID xuất hiện trong liên hệ đều đã có bản ghi chi phí tương ứng."
        />
      ) : (
        <AdminNewAdIdsView
          rows={rows}
          sourceOptions={sources.map((s) => s.name)}
          fanpageOptions={fanpages.map((f) => f.name)}
          branchOptions={branches}
        />
      )}
    </>
  );
}
