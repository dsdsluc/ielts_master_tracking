import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { LogsFilterBar } from "@/app/(app)/logs/logs-filter-bar";
import { LogsTable, type LogRow } from "@/app/(app)/logs/logs-table";

const PAGE_SIZE = 25;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; action?: string; result?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { page: pageParam, q, action, result } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const hasFilters = !!q?.trim() || (!!action && action !== "all") || (!!result && result !== "all");

  const where: Prisma.SystemLogWhereInput = {};
  if (action && action !== "all") where.action = action;
  if (result && result !== "all") where.result = result;
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { actorName: { contains: term, mode: "insensitive" } },
      { actorEmail: { contains: term, mode: "insensitive" } },
      { interactionId: { contains: term, mode: "insensitive" } },
    ];
  }

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (action && action !== "all") params.set("action", action);
    if (result && result !== "all") params.set("result", result);
    params.set("page", String(targetPage));
    return `/logs?${params.toString()}`;
  };

  const [totalItems, logs] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.findMany({
      where,
      orderBy: { loggedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { interaction: { select: { customerName: true } } },
    }),
  ]);

  const rows: LogRow[] = logs.map((l) => ({
    logId: l.logId,
    loggedAt: l.loggedAt.toISOString(),
    actorName: l.actorName,
    actorEmail: l.actorEmail,
    actorRole: l.actorRole,
    action: l.action,
    result: l.result,
    interactionId: l.interactionId,
    customerName: l.interaction?.customerName ?? null,
    detailOld: l.detailOld,
    detailNew: l.detailNew,
    technicalInfo: l.technicalInfo,
  }));

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Nhật ký"
        title="System Log"
        description="Nhật ký thao tác toàn hệ thống — phục vụ audit và đối chiếu."
        action={<LogsFilterBar />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? "Không tìm thấy nhật ký phù hợp" : "Chưa có nhật ký nào"}
          description={
            hasFilters
              ? "Thử đổi từ khoá tìm kiếm hoặc bộ lọc hành động/kết quả."
              : "Mọi thao tác quan trọng trên hệ thống sẽ được ghi lại tại đây."
          }
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{totalItems}</strong> dòng nhật ký
            </p>
          </div>
          <LogsTable rows={rows} />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Trang <strong className="font-mono text-foreground">{page}</strong>/{totalPages} ·{" "}
            <strong className="font-mono text-foreground">{totalItems}</strong> dòng nhật ký
          </p>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href={pageHref(page - 1)} />} aria-label="Trang trước">
                <ChevronLeft className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" size="icon-sm" className="rounded-full" disabled aria-label="Trang trước">
                <ChevronLeft className="size-4" />
              </Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href={pageHref(page + 1)} />} aria-label="Trang sau">
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button variant="outline" size="icon-sm" className="rounded-full" disabled aria-label="Trang sau">
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
