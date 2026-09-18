import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { prisma } from "@/lib/prisma";
import { FollowupTrackingFilterBar } from "@/app/(app)/followup-tracking/followup-tracking-filter-bar";
import { FollowupTrackingSalerTable } from "@/app/(app)/followup-tracking/followup-tracking-saler-table";
import type { FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";
import { computeFollowupStats, groupBySaler } from "@/app/(app)/followup-tracking/stats";

const DAYS_OPTIONS = [7, 30, 90];
const MAX_ROWS = 300;

export default async function FollowupTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; resolved?: string; days?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "followupTracking");
  const { branch, resolved, days } = await searchParams;

  const branches = await prisma.branch.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } });

  const where: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(user),
    activeFlag: true,
    mktPushedAt: { not: null },
  };
  if (branch && branch !== "all" && canAccessBranch(user, branch)) {
    where.assignedBranchCode = branch;
  }
  if (resolved === "pending") where.needsFollowup = true;
  if (resolved === "resolved") where.needsFollowup = false;

  const daysNum = DAYS_OPTIONS.includes(Number(days)) ? Number(days) : null;
  if (daysNum) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysNum);
    where.mktPushedAt = { not: null, gte: cutoff };
  }

  const rows = await prisma.interaction.findMany({
    where,
    select: {
      interactionId: true,
      customerName: true,
      statusName: true,
      assignedBranchCode: true,
      needsFollowup: true,
      mktPushedAt: true,
      mktSuggestion: true,
      followupHandledAt: true,
      followupOutcome: true,
      followupResolvedCount: true,
      followupTargetSaleEmail: true,
      mktPushedBy: { select: { fullName: true } },
      followupHandledBy: { select: { fullName: true } },
      followupTargetSale: { select: { fullName: true } },
    },
    orderBy: { mktPushedAt: "desc" },
    take: MAX_ROWS,
  });

  const tableRows: FollowupTrackingRow[] = rows.map((r) => ({
    interactionId: r.interactionId,
    customerName: r.customerName,
    status: r.statusName,
    assignedBranchCode: r.assignedBranchCode,
    mktSuggestion: r.mktSuggestion,
    mktPushedAt: r.mktPushedAt!.toISOString(),
    mktPushedByName: r.mktPushedBy?.fullName ?? null,
    needsFollowup: r.needsFollowup,
    followupHandledAt: r.followupHandledAt?.toISOString() ?? null,
    followupHandledByName: r.followupHandledBy?.fullName ?? null,
    followupOutcome: r.followupOutcome,
    followupResolvedCount: r.followupResolvedCount,
    saleEmail: r.followupTargetSaleEmail,
    saleName: r.followupTargetSale?.fullName ?? null,
    // Bảng tổng hợp theo Sale không hiển thị ghi chú xử lý từng liên hệ — chỉ
    // trang chi tiết /followup-tracking/[saleKey] mới cần tra cứu log này.
    resolveNote: null,
  }));

  const stats = computeFollowupStats(tableRows);
  const salerSummaries = groupBySaler(tableRows);

  const detailQuery = (() => {
    const params = new URLSearchParams();
    if (branch && branch !== "all") params.set("branch", branch);
    if (resolved) params.set("resolved", resolved);
    if (days) params.set("days", days);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Theo dõi hiệu quả chăm sóc lại"
        description='Kết quả các yêu cầu "Cần chăm sóc lại" theo từng Sale được phân công — bấm vào 1 Sale để xem chi tiết từng liên hệ.'
      />

      <FollowupTrackingFilterBar branches={branches} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Đã gửi" value={stats.total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đang chờ xử lý" value={stats.pending} accentClassName="bg-status-waiting" />
        <KpiCard label="Đã xử lý" value={stats.resolvedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Thời gian xử lý TB" value={stats.avgResolveLabel} accentClassName="bg-primary" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Chuyển đổi thật (ra SĐT)" value={stats.convertedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${stats.conversionRate.toFixed(1)}%`} accentClassName="bg-status-qualified" />
        <KpiCard label="Spam trong chăm sóc lại" value={stats.spamCount} accentClassName="bg-destructive" />
        <KpiCard label="Đóng thủ công (không rõ kết quả)" value={stats.manualDismissCount} accentClassName="bg-muted-foreground/40" />
      </div>

      {stats.total > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Tỷ lệ đã xử lý: <strong className="font-mono text-foreground">{stats.resolvedRate.toFixed(1)}%</strong> · Chuyển đổi thật (ra SĐT) chiếm{" "}
          <strong className="font-mono text-foreground">{stats.conversionRate.toFixed(1)}%</strong> · Spam sau khi được nhắc chiếm{" "}
          <strong className="font-mono text-foreground">{stats.spamRate.toFixed(1)}%</strong> tổng số đã gửi.
        </p>
      )}

      <FollowupTrackingSalerTable salers={salerSummaries} detailQuery={detailQuery} />
    </>
  );
}
