import Link from "next/link";
import { ChevronRight, ScrollText, User as UserIcon } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { ROLES } from "@/lib/interactions/constants";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import {
  ADMIN_ONLY_ACTIONS,
  LOG_CATEGORY_META,
  LOG_CATEGORY_OPTIONS,
  actionCategory,
  type LogCategoryKey,
} from "@/app/(app)/logs/format";
import { LogsStatsFilterBar } from "@/app/(app)/logs/logs-stats-filter-bar";
import { SYSTEM_ACTOR_KEY } from "@/app/(app)/logs/shared";

const EMPTY_CATEGORY_COUNTS: Record<LogCategoryKey, number> = { lead: 0, followup: 0, student: 0, sla: 0 };

type ActorStat = {
  email: string | null;
  name: string;
  role: string | null;
  active: boolean;
  total: number;
  failCount: number;
  lastActivityAt: string;
  categoryCounts: Record<LogCategoryKey, number>;
};

// Trang "Nhật ký hoạt động" đổi từ 1 feed dài lê thê (mọi dòng, mọi người trộn
// chung) sang mô hình thống kê — TỔNG QUAN theo từng người ở đây, bấm vào 1
// người mới xem nhật ký chi tiết của riêng họ (/logs/[email]) — dễ theo dõi
// toàn diện hơn nhiều so với cuộn qua hàng nghìn dòng lẫn lộn.
export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "logs");
  const { q, role } = await searchParams;

  // Cùng loại trừ CLEANUP_* như bản feed cũ — đây là việc dọn dẹp hệ thống của
  // Admin, không phải việc nhân viên làm với khách/học viên.
  const where: Prisma.SystemLogWhereInput = { action: { notIn: ADMIN_ONLY_ACTIONS } };

  const [actionGroups, failGroups, lastGroups] = await Promise.all([
    prisma.systemLog.groupBy({ by: ["actorEmail", "action"], where, _count: { _all: true } }),
    prisma.systemLog.groupBy({ by: ["actorEmail"], where: { ...where, result: "FAIL" }, _count: { _all: true } }),
    prisma.systemLog.groupBy({ by: ["actorEmail"], where, _max: { loggedAt: true } }),
  ]);

  const failByEmail = new Map(failGroups.map((g) => [g.actorEmail, g._count._all]));
  const lastByEmail = new Map(lastGroups.map((g) => [g.actorEmail, g._max.loggedAt]));

  const byEmail = new Map<string | null, { total: number; categoryCounts: Record<LogCategoryKey, number> }>();
  for (const g of actionGroups) {
    const entry = byEmail.get(g.actorEmail) ?? { total: 0, categoryCounts: { ...EMPTY_CATEGORY_COUNTS } };
    entry.total += g._count._all;
    const cat = actionCategory(g.action);
    if (cat) entry.categoryCounts[cat] += g._count._all;
    byEmail.set(g.actorEmail, entry);
  }

  // actorName/actorRole trên SystemLog là ảnh chụp TẠI THỜI ĐIỂM ghi log (có
  // thể lệch nếu người dùng đổi tên/vai trò sau đó) — ưu tiên đọc thẳng từ
  // User (hiện tại) cho đúng thực tế, chỉ fallback về email khi User không
  // còn (hiếm — hệ thống chỉ có khoá tài khoản, không xoá cứng User).
  const emails = [...byEmail.keys()].filter((e): e is string => e !== null);
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { email: true, fullName: true, role: true, active: true },
      })
    : [];
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  let stats: ActorStat[] = [...byEmail.entries()].map(([email, agg]) => {
    const u = email ? userByEmail.get(email) : undefined;
    return {
      email,
      name: u?.fullName ?? email ?? "Hệ thống / không xác định",
      role: u?.role ?? null,
      active: u?.active ?? true,
      total: agg.total,
      failCount: failByEmail.get(email) ?? 0,
      lastActivityAt: (lastByEmail.get(email) ?? new Date(0)).toISOString(),
      categoryCounts: agg.categoryCounts,
    };
  });

  if (role && role !== "all") stats = stats.filter((s) => s.role === role);
  if (q?.trim()) {
    const needle = q.trim().toLocaleLowerCase("vi");
    stats = stats.filter(
      (s) => s.name.toLocaleLowerCase("vi").includes(needle) || (s.email?.toLocaleLowerCase("vi").includes(needle) ?? false)
    );
  }

  stats.sort((a, b) => b.total - a.total);

  const roleOptions = [ROLES.MARKETING, ROLES.SALES, ROLES.LEADER, ROLES.ADMIN];

  return (
    <>
      <PageHeader
        eyebrow="Nhật ký"
        title="Thống kê hoạt động"
        description="Tổng hợp hoạt động theo từng người — bấm vào 1 người để xem nhật ký chi tiết của riêng họ."
        action={<LogsStatsFilterBar roleOptions={roleOptions} />}
      />

      {stats.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Không tìm thấy người phù hợp"
          description="Thử đổi từ khoá tìm kiếm hoặc bộ lọc vai trò."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/70 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{stats.length}</strong> người có hoạt động
            </p>
          </div>
          <div className="divide-y divide-border/60">
            {stats.map((s) => (
              <Link
                key={s.email ?? SYSTEM_ACTOR_KEY}
                href={`/logs/${encodeURIComponent(s.email ?? SYSTEM_ACTOR_KEY)}`}
                className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/30 sm:flex-nowrap"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <UserIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-medium text-foreground" title={s.name}>
                      {s.name}
                    </p>
                    {!s.active && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">Đã khoá</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                    {s.email && <span className="font-mono">{s.email}</span>}
                    {s.role && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{s.role}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {LOG_CATEGORY_OPTIONS.map((opt) => {
                      const count = s.categoryCounts[opt.value];
                      if (count === 0) return null;
                      const meta = LOG_CATEGORY_META[opt.value];
                      return (
                        <span key={opt.value} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.bgClass} ${meta.textClass}`}>
                          {meta.label}: {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 pl-12 text-right sm:pl-0">
                  <p className="font-mono text-lg font-semibold text-foreground">{s.total}</p>
                  {s.failCount > 0 && <p className="text-[11px] font-medium text-destructive">{s.failCount} thất bại</p>}
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(s.lastActivityAt)}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
