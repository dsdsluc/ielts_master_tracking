import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { getCurrentUser } from "@/lib/auth/dal";
import { INTERACTION_ACTIVITY, STATUS } from "@/lib/interactions/constants";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { AdLeadsTable } from "@/app/(app)/ads-performance/[adId]/ad-leads-table";

const DAYS_OPTIONS = [7, 30, 90];

// Router chi tiết cho "Hiệu suất theo Tư vấn viên" ở Dashboard tổng ("/") —
// bấm vào 1 dòng Sale để xem sâu hơn thay vì chỉ có 1 hàng số liệu tổng hợp.
// Cùng khoảng ngày với Dashboard (truyền qua query) để số liệu khớp đúng cái
// admin đang xem, không phải tính lại theo mặc định khác.
export default async function SalePerformanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ days?: string; from?: string; to?: string }>;
}) {
  await getCurrentUser();
  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail);
  const { days: daysParam, from: fromParam, to: toParam } = await searchParams;

  const days = DAYS_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;
  const customFrom = fromParam ? new Date(fromParam) : null;
  const customTo = toParam ? new Date(toParam) : null;
  const hasCustomRange = !!(customFrom && !Number.isNaN(customFrom.getTime()) && customTo && !Number.isNaN(customTo.getTime()));

  let windowStart: Date;
  let windowEnd: Date | undefined;
  if (hasCustomRange) {
    windowStart = new Date(customFrom!);
    windowStart.setHours(0, 0, 0, 0);
    windowEnd = new Date(customTo!);
    windowEnd.setHours(0, 0, 0, 0);
    windowEnd.setDate(windowEnd.getDate() + 1);
  } else {
    windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - (days - 1));
    windowStart.setHours(0, 0, 0, 0);
    windowEnd = undefined;
  }
  const createdWindow = windowEnd ? { gte: windowStart, lt: windowEnd } : { gte: windowStart };
  const rangeLabel = hasCustomRange
    ? `${windowStart.toLocaleDateString("vi-VN")} – ${customTo!.toLocaleDateString("vi-VN")}`
    : `${days} ngày gần nhất`;

  const [sale, branches, createdCount, closedGroups, touchCount, qualifyRows, leadRows] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { fullName: true, branchCode: true } }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.interaction.count({ where: { createdByEmail: email, activeFlag: true, createdLeadAt: createdWindow } }),
    prisma.interaction.groupBy({
      by: ["statusName"],
      where: { updatedByEmail: email, activeFlag: true, closedAt: createdWindow, statusName: { in: [STATUS.PHONE, STATUS.SPAM] } },
      _count: { _all: true },
    }),
    prisma.interactionFieldLog.count({ where: { changedByEmail: email, fieldKey: INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED, changedAt: createdWindow } }),
    prisma.interaction.findMany({
      where: { assignedSaleEmail: email, activeFlag: true, receivedAt: { not: null }, createdLeadAt: createdWindow },
      select: { createdLeadAt: true, receivedAt: true },
    }),
    prisma.interaction.findMany({
      where: { OR: [{ createdByEmail: email }, { assignedSaleEmail: email }], activeFlag: true, createdLeadAt: createdWindow },
      include: listItemInclude,
      orderBy: { createdLeadAt: "desc" },
      take: 200,
    }),
  ]);

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const qualified = closedGroups.find((g) => g.statusName === STATUS.PHONE)?._count._all ?? 0;
  const spam = closedGroups.find((g) => g.statusName === STATUS.SPAM)?._count._all ?? 0;
  const conversionRate = qualified + spam > 0 ? (qualified / (qualified + spam)) * 100 : null;
  const durations = qualifyRows.map((r) => (r.receivedAt!.getTime() - r.createdLeadAt.getTime()) / 3600000);
  const avgQualifyHours = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const items = leadRows.map(toListItem);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/" />} aria-label="Quay lại Dashboard">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Hiệu suất tư vấn viên</span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{sale?.fullName ?? email}</h1>
          <p className="text-xs text-muted-foreground">
            {email} · {branchNames[sale?.branchCode ?? ""] ?? sale?.branchCode ?? "—"} · {rangeLabel}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tạo mới" value={createdCount} accentClassName="bg-foreground/50" />
        <KpiCard label="Đủ tiêu chuẩn" value={qualified} accentClassName="bg-status-qualified" />
        <KpiCard label="Spam" value={spam} accentClassName="bg-status-spam" />
        <KpiCard label="Số lần chăm sóc" value={touchCount} accentClassName="bg-status-received" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <KpiCard label="Tỷ lệ chuyển đổi" value={conversionRate != null ? `${conversionRate.toFixed(1)}%` : "—"} accentClassName="bg-primary" />
        <KpiCard label="TB thời gian đủ tiêu chuẩn" value={avgQualifyHours != null ? `~${Math.round(avgQualifyHours)}h` : "—"} accentClassName="bg-accent" />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Liên hệ trong khoảng thời gian này</h2>
      <AdLeadsTable items={items} branchNames={branchNames} />
    </>
  );
}
