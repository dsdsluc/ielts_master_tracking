import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { prisma } from "@/lib/prisma";
import { LogsFilterBar } from "@/app/(app)/logs/logs-filter-bar";
import { LogsFeed, type LogRow } from "@/app/(app)/logs/logs-feed";
import { ACTION_CATEGORY, ADMIN_ONLY_ACTIONS, LOG_CATEGORY_OPTIONS, type LogCategoryKey } from "@/app/(app)/logs/format";
import { SYSTEM_ACTOR_KEY } from "@/app/(app)/logs/shared";

const PAGE_SIZE = 60;

// Nhật ký CHI TIẾT của đúng 1 người — vào từ trang thống kê /logs (bấm 1
// dòng). Mọi logic bộ lọc/phân trang/dọn dẹp giữ y hệt bản feed chung cũ,
// chỉ khác đúng 1 điều kiện WHERE (actorEmail) và tiêu đề trang.
export default async function LogsByActorPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ page?: string; q?: string; category?: string; result?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "logs");
  const { email: rawKey } = await params;
  const isSystem = rawKey === SYSTEM_ACTOR_KEY;
  const actorEmail = isSystem ? null : decodeURIComponent(rawKey);

  const actor = isSystem
    ? null
    : await prisma.user.findUnique({ where: { email: actorEmail! }, select: { fullName: true, role: true, active: true } });

  const { page: pageParam, q, category, result } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const validCategory = LOG_CATEGORY_OPTIONS.some((o) => o.value === category) ? (category as LogCategoryKey) : null;
  const hasFilters = !!q?.trim() || !!validCategory || (!!result && result !== "all");

  const where: Prisma.SystemLogWhereInput = { action: { notIn: ADMIN_ONLY_ACTIONS }, actorEmail };
  if (validCategory) {
    where.action = { in: Object.entries(ACTION_CATEGORY).filter(([, cat]) => cat === validCategory).map(([action]) => action) };
  }
  if (result && result !== "all") where.result = result;
  // Đã lọc theo đúng 1 actor rồi nên chỉ còn tìm theo mã liên hệ có ý nghĩa
  // (khác bản feed chung /logs — nơi còn phải tìm theo cả tên người thực hiện).
  if (q?.trim()) where.interactionId = { contains: q.trim(), mode: "insensitive" };

  const basePath = `/logs/${rawKey}`;
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (validCategory) params.set("category", validCategory);
    if (result && result !== "all") params.set("result", result);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
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
  const displayName = isSystem ? "Hệ thống / không xác định" : (actor?.fullName ?? actorEmail!);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/logs" />}
          aria-label="Quay lại thống kê hoạt động"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Nhật ký · {displayName}</span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Nhật ký hoạt động</h1>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {isSystem
            ? "Các dòng nhật ký không gắn được với người thực hiện cụ thể."
            : `Toàn bộ hoạt động của ${displayName}${actor?.role ? ` (${actor.role})` : ""}${actor && !actor.active ? " — tài khoản đã khoá" : ""}.`}
        </p>
        <LogsFilterBar basePath={basePath} searchPlaceholder="Tìm mã liên hệ…" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? "Không tìm thấy hoạt động phù hợp" : "Chưa có hoạt động nào"}
          description={hasFilters ? "Thử đổi từ khoá tìm kiếm hoặc bộ lọc nhóm hành động/kết quả." : "Người này chưa có hoạt động nào được ghi nhận."}
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
