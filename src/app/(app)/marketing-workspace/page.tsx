import Link from "next/link";
import { ArrowRight, CalendarCheck, ListPlus, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { getPageReportRows } from "@/lib/marketing/page-report";
import { PageReportTable } from "@/app/(app)/page-report/page-report-table";
import { AdsCostDialog } from "@/app/(app)/ads-cost/ads-cost-dialog";
import { NewAdIdsView, type NewAdIdRow } from "@/app/(app)/new-ad-ids/new-ad-ids-view";
import { formatVnd } from "@/app/(app)/ads-cost/format";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MarketingWorkspacePage() {
  const user = await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const today = todayStr();
  const canClose = user.role === ROLES.ADMIN || user.canCloseMktReport;

  const [pageReportRows, leadRows, existingCosts, totalCostAgg, sources, fanpages, branches] = await Promise.all([
    getPageReportRows(today),
    // "Ad ID mới" = Ad ID xuất hiện trong liên hệ nhưng chưa có bản ghi chi phí
    // tương ứng — mirror new-ad-ids/page.tsx.
    prisma.interaction.findMany({
      where: { adId: { not: null }, activeFlag: true },
      select: { adId: true, sourceName: true, fanpageName: true, assignedBranchCode: true, createdLeadAt: true },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.adsCost.findMany({ select: { adId: true }, distinct: ["adId"] }),
    prisma.adsCost.aggregate({ _sum: { costVnd: true } }),
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
      byAdId.set(adId, { count: 1, firstSeenAt: r.createdLeadAt, sourceName: r.sourceName, fanpageName: r.fanpageName, branchCode: r.assignedBranchCode });
    }
  }
  const newAdIdRows: NewAdIdRow[] = [...byAdId.entries()]
    .map(([adId, b]) => ({
      adId,
      leadCount: b.count,
      firstSeenAt: b.firstSeenAt.toISOString(),
      suggestedSourceName: b.sourceName,
      suggestedFanpageName: b.fanpageName,
      suggestedBranchCode: b.branchCode,
    }))
    .sort((a, b) => b.leadCount - a.leadCount);

  const closedCount = pageReportRows.filter((r) => r.closed).length;
  const sourceOptions = sources.map((s) => s.name);
  const fanpageNameOptions = fanpages.map((f) => f.name);
  const totalCost = totalCostAgg._sum.costVnd?.toString() ?? "0";

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Workspace Marketing"
        description="Trung tâm xử lý hằng ngày — chốt báo cáo Page, ghi nhận chi phí quảng cáo mới, xử lý Ad ID mới phát hiện."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Page đã chốt hôm nay" value={`${closedCount}/${pageReportRows.length}`} accentClassName="bg-status-received" />
        <KpiCard label="Ad ID mới cần xử lý" value={newAdIdRows.length} accentClassName="bg-status-waiting" />
        <KpiCard label="Tổng chi phí quảng cáo" value={formatVnd(totalCost)} accentClassName="bg-primary" />
      </div>

      <Card className="mb-6">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-1.5">
            <CalendarCheck className="size-4 text-status-received" /> Báo cáo Page hằng ngày — hôm nay
          </CardTitle>
          <CardDescription>Chốt để giữ nguyên số liệu trong ngày. Xem ngày khác hoặc lịch sử tại trang đầy đủ.</CardDescription>
          <CardAction>
            <Link href="/page-report" className="inline-flex items-center gap-1 text-xs font-medium text-status-received hover:underline">
              Xem đầy đủ <ArrowRight className="size-3.5" />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!canClose && (
            <p className="mb-3 text-xs text-muted-foreground">
              Bạn chỉ có thể xem — chưa được cấp quyền chốt báo cáo (liên hệ Quản trị hệ thống ở trang Người dùng nếu cần).
            </p>
          )}
          {pageReportRows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Chưa có Page nào" description="Thêm Page đang hoạt động ở trang Fanpage để bắt đầu theo dõi." />
          ) : (
            <PageReportTable rows={pageReportRows} date={today} canClose={canClose} isAdmin={user.role === ROLES.ADMIN} />
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-1.5">
            <Megaphone className="size-4 text-primary" /> Chi phí quảng cáo
          </CardTitle>
          <CardDescription>Ghi nhận chi phí mới theo Ad ID — dùng khi vừa có kỳ chi phí cần nhập.</CardDescription>
          <CardAction>
            <AdsCostDialog mode="create" sourceOptions={sourceOptions} fanpageOptions={fanpageNameOptions} branchOptions={branches} />
          </CardAction>
        </CardHeader>
      </Card>

      <div className="mb-2.5 flex items-center gap-2.5">
        <ListPlus className="size-4 text-status-waiting" />
        <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Ad ID mới</h2>
      </div>
      <NewAdIdsView rows={newAdIdRows} sourceOptions={sourceOptions} fanpageOptions={fanpages} branchOptions={branches} />
    </>
  );
}
