import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { AdLeadsTable } from "@/app/(app)/ads-performance/[adId]/ad-leads-table";
import { cn } from "@/lib/utils";

const DAYS_OPTIONS = [7, 30, 90];
const MAX_ROWS = 300;

const STATUS_TABS = [
  { key: undefined, label: "Tổng liên hệ" },
  { key: STATUS.WAITING, label: "Chờ" },
  { key: STATUS.PROCESSING, label: "Tiếp nhận" },
  { key: STATUS.PHONE, label: "Đủ tiêu chuẩn" },
  { key: STATUS.SPAM, label: "Spam" },
] as const;

// Router chi tiết cho các ô KPI ở Dashboard tổng ("/") — bấm vào 1 ô (Tổng
// liên hệ/Đủ tiêu chuẩn/Tiếp nhận/Spam) để xem đúng danh sách liên hệ đứng
// sau con số đó, thay vì chỉ có mỗi con số. Đây là view QUẢN TRỊ (toàn hệ
// thống theo scope của actor), khác /leads (công cụ tác nghiệp riêng của
// Sale) — nên tách route riêng, không dùng lại /leads cho đối tượng khác.
export default async function InteractionsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    days?: string;
    branch?: string;
    source?: string;
    fanpage?: string;
    adId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const { status, days: daysParam, branch: branchParam, source: sourceParam, fanpage: fanpageParam, adId: adIdParam, from: fromParam, to: toParam } =
    await searchParams;

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

  const where: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(user),
    activeFlag: true,
    createdLeadAt: createdWindow,
  };
  if (branchParam && branchParam !== "all" && canAccessBranch(user, branchParam)) where.assignedBranchCode = branchParam;
  if (sourceParam && sourceParam !== "all") where.sourceName = sourceParam;
  if (fanpageParam && fanpageParam !== "all") where.fanpageName = fanpageParam;
  if (adIdParam?.trim()) where.adId = { contains: adIdParam.trim(), mode: "insensitive" };
  if (status) where.statusName = status;

  function tabHref(tabStatus?: string) {
    const params = new URLSearchParams();
    if (tabStatus) params.set("status", tabStatus);
    if (hasCustomRange) {
      params.set("from", fromParam!);
      params.set("to", toParam!);
    } else {
      params.set("days", String(days));
    }
    if (branchParam && branchParam !== "all") params.set("branch", branchParam);
    if (sourceParam && sourceParam !== "all") params.set("source", sourceParam);
    if (fanpageParam && fanpageParam !== "all") params.set("fanpage", fanpageParam);
    if (adIdParam?.trim()) params.set("adId", adIdParam.trim());
    return `/interactions-overview?${params.toString()}`;
  }

  const [branches, totalCount, rows] = await Promise.all([
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.interaction.count({ where }),
    prisma.interaction.findMany({ where, include: listItemInclude, orderBy: { createdLeadAt: "desc" }, take: MAX_ROWS }),
  ]);

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const items = rows.map(toListItem);
  const activeLabel = STATUS_TABS.find((t) => t.key === status)?.label ?? "Tổng liên hệ";

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/" />} aria-label="Quay lại Dashboard">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Quản trị hệ thống</span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{activeLabel}</h1>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-full bg-secondary/70 p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tabHref(tab.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab.key === status ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-6">
        <KpiCard label={activeLabel} value={totalCount} accentClassName="bg-status-received" />
      </div>

      {totalCount > MAX_ROWS && (
        <p className="mb-4 text-xs text-muted-foreground">
          Đang hiện <strong className="font-mono text-foreground">{MAX_ROWS}</strong>/{totalCount} liên hệ mới nhất — thu hẹp bộ lọc ở Dashboard để xem hết.
        </p>
      )}

      <AdLeadsTable items={items} branchNames={branchNames} />
    </>
  );
}
