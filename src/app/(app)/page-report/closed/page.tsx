import type { Prisma } from "@/generated/prisma/client";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { ClosedReportsFilterBar } from "@/app/(app)/page-report/closed/closed-reports-filter-bar";
import { ClosedReportsTable, type ClosedReportRow } from "@/app/(app)/page-report/closed/closed-reports-table";

export default async function ClosedPageReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fanpage?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { from, to, fanpage } = await searchParams;

  const where: Prisma.MktPageReportWhereInput = { closedAt: { not: null } };
  if (fanpage && fanpage !== "all") where.fanpageName = fanpage;
  if (from || to) {
    where.reportDate = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lt: new Date(new Date(`${to}T00:00:00`).getTime() + 86400000) } : {}),
    };
  }

  const [rows, fanpages] = await Promise.all([
    prisma.mktPageReport.findMany({
      where,
      include: { closedBy: { select: { fullName: true } } },
      orderBy: [{ reportDate: "desc" }, { fanpageName: "asc" }],
    }),
    prisma.fanpage.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const items: ClosedReportRow[] = rows.map((r) => {
    const totalLeads = r.totalLeads ?? 0;
    const qualifiedLeads = r.qualifiedLeads ?? 0;
    return {
      reportDate: r.reportDate.toISOString(),
      fanpageName: r.fanpageName,
      totalLeads,
      qualifiedLeads,
      conversionRate: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0,
      closedAt: r.closedAt!.toISOString(),
      closedByName: r.closedBy?.fullName ?? null,
    };
  });

  const totalLeads = items.reduce((sum, r) => sum + r.totalLeads, 0);
  const totalQualified = items.reduce((sum, r) => sum + r.qualifiedLeads, 0);
  const overallRate = totalLeads > 0 ? (totalQualified / totalLeads) * 100 : 0;
  const hasFilters = !!from || !!to || (!!fanpage && fanpage !== "all");

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Tổng quan báo cáo đã chốt"
        description="Toàn bộ báo cáo Page đã chốt theo mọi ngày — số liệu snapshot cố định tại thời điểm chốt, không đổi theo dữ liệu sống nữa."
        action={<ClosedReportsFilterBar fanpageOptions={fanpages.map((f) => f.name)} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={hasFilters ? "Báo cáo đã chốt (đã lọc)" : "Báo cáo đã chốt"} value={items.length} accentClassName="bg-status-received" />
        <KpiCard label="Tổng tin nhắn" value={totalLeads} accentClassName="bg-foreground/50" />
        <KpiCard label="Tổng khách xin SĐT" value={totalQualified} accentClassName="bg-status-qualified" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${overallRate.toFixed(1)}%`} accentClassName="bg-primary" />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={hasFilters ? "Không có báo cáo phù hợp" : "Chưa có báo cáo nào được chốt"}
          description={
            hasFilters
              ? "Thử đổi khoảng ngày hoặc Page đang lọc."
              : "Khi chốt báo cáo Page hằng ngày, chúng sẽ xuất hiện ở đây."
          }
        />
      ) : (
        <ClosedReportsTable items={items} />
      )}
    </>
  );
}
