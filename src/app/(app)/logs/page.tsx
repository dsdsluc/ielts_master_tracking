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
import { LogsFeed, type LogRow } from "@/app/(app)/logs/logs-feed";
import { ACTION_CATEGORY, ADMIN_ONLY_ACTIONS, LOG_CATEGORY_OPTIONS, type LogCategoryKey } from "@/app/(app)/logs/format";

const PAGE_SIZE = 60;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string; result?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { page: pageParam, q, category, result } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const validCategory = LOG_CATEGORY_OPTIONS.some((o) => o.value === category) ? (category as LogCategoryKey) : null;
  const hasFilters = !!q?.trim() || !!validCategory || (!!result && result !== "all");

  // Trang này chỉ liệt kê hành động NHÂN VIÊN đã làm với khách/học viên — các
  // thao tác dọn dẹp dữ liệu hệ thống (chỉ Admin dùng) không thuộc phạm vi
  // này nên loại thẳng ở truy vấn, không chỉ ẩn ở bộ lọc.
  const where: Prisma.SystemLogWhereInput = { action: { notIn: ADMIN_ONLY_ACTIONS } };
  if (validCategory) {
    where.action = { in: Object.entries(ACTION_CATEGORY).filter(([, cat]) => cat === validCategory).map(([action]) => action) };
  }
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
    if (validCategory) params.set("category", validCategory);
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
        title="Nhật ký hoạt động"
        description="Những việc nhân viên đã làm với liên hệ, chăm sóc lại và học viên — nhóm theo màu để dễ quét mắt."
        action={<LogsFilterBar />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? "Không tìm thấy hoạt động phù hợp" : "Chưa có hoạt động nào"}
          description={
            hasFilters
              ? "Thử đổi từ khoá tìm kiếm hoặc bộ lọc nhóm hành động/kết quả."
              : "Mọi thao tác của nhân viên trên liên hệ, chăm sóc lại và học viên sẽ xuất hiện tại đây."
          }
        />
      ) : (
        <LogsFeed rows={rows} totalItems={totalItems} />
      )}

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Trang <strong className="font-mono text-foreground">{page}</strong>/{totalPages} ·{" "}
            <strong className="font-mono text-foreground">{totalItems}</strong> hoạt động
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
