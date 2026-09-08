import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { requireRole } from "@/lib/auth/dal";
import { CAN_PUSH_FOLLOWUP } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { prisma } from "@/lib/prisma";
import { FollowupTrackingFilterBar } from "@/app/(app)/followup-tracking/followup-tracking-filter-bar";
import { FollowupTrackingTable, type FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";

const DAYS_OPTIONS = [7, 30, 90];
const MAX_ROWS = 300;

export default async function FollowupTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; resolved?: string; days?: string }>;
}) {
  const user = await requireRole(...CAN_PUSH_FOLLOWUP);
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
      mktPushedBy: { select: { fullName: true } },
      followupHandledBy: { select: { fullName: true } },
    },
    orderBy: { mktPushedAt: "desc" },
    take: MAX_ROWS,
  });

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
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
  }));

  const total = tableRows.length;
  const pending = tableRows.filter((r) => r.needsFollowup).length;
  const resolvedCount = total - pending;
  const resolvedRate = total > 0 ? (resolvedCount / total) * 100 : 0;
  const resolvedDurationsHours = tableRows
    .filter((r) => r.followupHandledAt)
    .map((r) => (new Date(r.followupHandledAt as string).getTime() - new Date(r.mktPushedAt).getTime()) / 3600000);
  const avgResolveHours =
    resolvedDurationsHours.length > 0 ? resolvedDurationsHours.reduce((a, b) => a + b, 0) / resolvedDurationsHours.length : null;
  const avgResolveLabel = avgResolveHours == null ? "—" : avgResolveHours < 24 ? `${Math.round(avgResolveHours)} giờ` : `${(avgResolveHours / 24).toFixed(1)} ngày`;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Theo dõi hiệu quả chăm sóc lại"
        description='Kết quả các yêu cầu "Cần chăm sóc lại" đã gửi cho Sale — ai đã xử lý, ai chưa.'
      />

      <FollowupTrackingFilterBar branches={branches} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Đã gửi" value={total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đang chờ xử lý" value={pending} accentClassName="bg-status-waiting" />
        <KpiCard label="Đã xử lý" value={resolvedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Thời gian xử lý TB" value={avgResolveLabel} accentClassName="bg-primary" />
      </div>

      {total > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Tỷ lệ đã xử lý: <strong className="font-mono text-foreground">{resolvedRate.toFixed(1)}%</strong>
        </p>
      )}

      <FollowupTrackingTable rows={tableRows} branchNames={branchNames} />
    </>
  );
}
