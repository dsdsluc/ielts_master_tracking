import Link from "next/link";
import { ChevronRight, Megaphone, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { cached } from "@/lib/cache";
import { ConversionPill } from "@/app/(app)/ads-performance/ads-performance-table";
import { DashboardFilterBar } from "@/app/(app)/dashboard-filter-bar";

const REPORT_ROLES = [ROLES.LEADER, ROLES.MARKETING, ROLES.BOARD, ROLES.ADMIN] as const;
const DAYS_OPTIONS = [7, 30, 90];

type DashboardKpi = { total: number; waiting: number; processing: number; qualified: number; spam: number };

// Quét toàn bộ interaction trong cửa sổ ngày rồi group theo trạng thái — trang
// mặc định BGĐ/Leader/Admin/Marketing mở đầu tiên nên tần suất xem cao. Cache
// theo đúng scope thật (branchScopeWhere) bằng cách dùng chính where-clause
// làm 1 phần khoá — tự động đúng nếu logic phân quyền chi nhánh đổi sau này.
async function computeDashboardKpi(where: Prisma.InteractionWhereInput): Promise<DashboardKpi> {
  const rows = await prisma.interaction.findMany({ where, select: { statusName: true } });
  const kpi: DashboardKpi = { total: rows.length, waiting: 0, processing: 0, qualified: 0, spam: 0 };
  for (const row of rows) {
    if (row.statusName === STATUS.WAITING) kpi.waiting++;
    else if (row.statusName === STATUS.PROCESSING) kpi.processing++;
    else if (row.statusName === STATUS.PHONE) kpi.qualified++;
    else if (row.statusName === STATUS.SPAM) kpi.spam++;
  }
  return kpi;
}

type TopAdRow = { adId: string; sourceName: string; fanpageName: string; totalLeads: number; qualified: number; conversionRate: number };

// Rẻ hơn hẳn computeAdsPerformanceData (ads-performance/page.tsx) vì bỏ hẳn
// bước join AdsCost — widget này chỉ cần số lượng/tỷ lệ chuyển đổi, không cần
// chi phí, nên chỉ 1 query duy nhất, không N+1.
async function computeTopAds(where: Prisma.InteractionWhereInput): Promise<TopAdRow[]> {
  const rows = await prisma.interaction.findMany({
    where: { ...where, adId: { not: null } },
    select: { adId: true, statusName: true, sourceName: true, fanpageName: true },
  });

  const byAd = new Map<string, { total: number; qualified: number; sourceName: string; fanpageName: string }>();
  for (const r of rows) {
    const adId = r.adId as string;
    const bucket = byAd.get(adId) ?? { total: 0, qualified: 0, sourceName: r.sourceName, fanpageName: r.fanpageName };
    bucket.total++;
    if (r.statusName === STATUS.PHONE) bucket.qualified++;
    byAd.set(adId, bucket);
  }

  return [...byAd.entries()]
    .map(([adId, b]) => ({
      adId,
      sourceName: b.sourceName,
      fanpageName: b.fanpageName,
      totalLeads: b.total,
      qualified: b.qualified,
      conversionRate: b.total > 0 ? (b.qualified / b.total) * 100 : 0,
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .slice(0, 5);
}

type SalePerfRow = {
  email: string;
  fullName: string;
  branchName: string;
  created: number;
  qualified: number;
  spam: number;
  conversionRate: number | null;
  touches: number;
  avgQualifyHours: number | null;
};

// Ghép từ nhiều groupBy rẻ (không include/join nặng) — cùng cách admin/page.tsx
// đã làm cho bảng "So sánh hiệu suất Sale", bổ sung thêm số lần chăm sóc thật
// (SystemLog TOUCH — touchCount trên Interaction chỉ là số thứ tự lượt chạm
// của KHÁCH, không phải số lần Sale thao tác) và thời gian trung bình từ lúc
// tạo lead đến lúc đủ tiêu chuẩn (không có mốc "liên hệ lần đầu" riêng trong
// schema nên đây là proxy gần nhất cho tốc độ xử lý).
async function computeSalePerformance(
  scope: Prisma.InteractionWhereInput,
  windowStart: Date,
  branchNameByCode: Map<string, string>
): Promise<SalePerfRow[]> {
  const [sales, createdGroups, closedGroups, touchGroups, qualifyRows] = await Promise.all([
    prisma.user.findMany({ where: { role: ROLES.SALES, active: true }, select: { email: true, fullName: true, branchCode: true } }),
    prisma.interaction.groupBy({
      by: ["createdByEmail"],
      where: { ...scope, activeFlag: true, createdLeadAt: { gte: windowStart } },
      _count: { _all: true },
    }),
    prisma.interaction.groupBy({
      by: ["updatedByEmail", "statusName"],
      where: {
        ...scope,
        activeFlag: true,
        closedAt: { gte: windowStart },
        statusName: { in: [STATUS.PHONE, STATUS.SPAM] },
        updatedByEmail: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.systemLog.groupBy({ by: ["actorEmail"], where: { action: SYSTEM_LOG_ACTION.TOUCH, loggedAt: { gte: windowStart } }, _count: { _all: true } }),
    prisma.interaction.findMany({
      where: { ...scope, activeFlag: true, assignedSaleEmail: { not: null }, receivedAt: { not: null }, createdLeadAt: { gte: windowStart } },
      select: { assignedSaleEmail: true, createdLeadAt: true, receivedAt: true },
    }),
  ]);

  const createdByEmail = new Map(createdGroups.map((g) => [g.createdByEmail, g._count._all]));
  const qualifiedByEmail = new Map<string, number>();
  const spamByEmail = new Map<string, number>();
  for (const g of closedGroups) {
    if (!g.updatedByEmail) continue;
    if (g.statusName === STATUS.PHONE) qualifiedByEmail.set(g.updatedByEmail, g._count._all);
    else if (g.statusName === STATUS.SPAM) spamByEmail.set(g.updatedByEmail, g._count._all);
  }
  const touchByEmail = new Map(touchGroups.map((g) => [g.actorEmail, g._count._all]));

  const qualifyDurationsByEmail = new Map<string, number[]>();
  for (const r of qualifyRows) {
    const email = r.assignedSaleEmail!;
    const hours = (r.receivedAt!.getTime() - r.createdLeadAt.getTime()) / 3600000;
    const list = qualifyDurationsByEmail.get(email) ?? [];
    list.push(hours);
    qualifyDurationsByEmail.set(email, list);
  }

  const rows: SalePerfRow[] = sales.map((s) => {
    const qualified = qualifiedByEmail.get(s.email) ?? 0;
    const spam = spamByEmail.get(s.email) ?? 0;
    const durations = qualifyDurationsByEmail.get(s.email) ?? [];
    return {
      email: s.email,
      fullName: s.fullName,
      branchName: branchNameByCode.get(s.branchCode ?? "") ?? s.branchCode ?? "—",
      created: createdByEmail.get(s.email) ?? 0,
      qualified,
      spam,
      conversionRate: qualified + spam > 0 ? (qualified / (qualified + spam)) * 100 : null,
      touches: touchByEmail.get(s.email) ?? 0,
      avgQualifyHours: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    };
  });

  return rows
    .filter((r) => r.created > 0 || r.qualified > 0 || r.spam > 0 || r.touches > 0)
    .sort((a, b) => b.qualified - a.qualified || b.created - a.created)
    .slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; branch?: string; source?: string }>;
}) {
  const user = await requireRole(...REPORT_ROLES);
  const { days: daysParam, branch: branchParam, source: sourceParam } = await searchParams;

  const days = DAYS_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (days - 1));
  windowStart.setHours(0, 0, 0, 0);

  const [branches, sourceRows] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const branchNameByCode = new Map(branches.map((b) => [b.code, b.name]));

  const scope = branchScopeWhere(user);
  const branchFilter: Prisma.InteractionWhereInput =
    branchParam && branchParam !== "all" && canAccessBranch(user, branchParam) ? { assignedBranchCode: branchParam } : {};
  // Chỉ phạm vi cơ sở (+ bộ lọc cơ sở đang chọn) — KHÔNG kèm createdLeadAt, vì
  // computeSalePerformance tự áp field ngày khác nhau cho từng truy vấn con
  // (tạo mới theo createdLeadAt, đóng theo closedAt) — gộp sẵn createdLeadAt
  // vào đây sẽ vô tình lọc nhầm cả những lead tạo trước cửa sổ nhưng đóng
  // trong cửa sổ.
  const scopeWithBranch: Prisma.InteractionWhereInput = { ...scope, ...branchFilter };
  const where: Prisma.InteractionWhereInput = {
    ...scopeWithBranch,
    activeFlag: true,
    createdLeadAt: { gte: windowStart },
  };
  if (sourceParam && sourceParam !== "all") {
    where.sourceName = sourceParam;
  }

  const cacheKey = `dash:overview:v2:${JSON.stringify(scope)}:${days}:${branchParam ?? "all"}:${sourceParam ?? "all"}`;

  // Điều hướng sang /customers lọc theo trạng thái — nơi duy nhất Sale/Leader/
  // Admin có thể xem danh sách khách theo trạng thái hiện có sẵn URL param.
  function customerStatusHref(status?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const qs = params.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  }

  const canSeeSaleOps = user.role === ROLES.LEADER || user.role === ROLES.ADMIN;
  const canSeeMarketingOps = user.role === ROLES.MARKETING || user.role === ROLES.ADMIN;

  const [kpi, topAds, salePerf] = await Promise.all([
    cached(cacheKey, 90, () => computeDashboardKpi(where)),
    canSeeMarketingOps ? cached(`${cacheKey}:top-ads`, 90, () => computeTopAds(where)) : Promise.resolve([]),
    canSeeSaleOps
      ? cached(`${cacheKey}:sale-perf`, 90, () => computeSalePerformance(scopeWithBranch, windowStart, branchNameByCode))
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Dashboard"
        description="Theo dõi chất lượng nguồn và kết quả chuyển đổi thực tế."
        action={<DashboardFilterBar branches={branches} sources={sourceRows.map((s) => s.name)} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href={customerStatusHref()} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Tổng liên hệ" value={kpi.total} accentClassName="bg-foreground/50" />
        </Link>
        <Link href={customerStatusHref(STATUS.PHONE)} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Đủ tiêu chuẩn" value={kpi.qualified} accentClassName="bg-status-qualified" />
        </Link>
        <Link href={customerStatusHref(STATUS.PROCESSING)} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Tiếp nhận" value={kpi.processing} accentClassName="bg-status-received" />
        </Link>
        <Link href={customerStatusHref(STATUS.SPAM)} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Spam" value={kpi.spam} accentClassName="bg-status-spam" />
        </Link>
      </div>

      {canSeeMarketingOps && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <TrendingUp className="size-3.5" />
              Quảng cáo thu hút nhiều liên hệ nhất ({days} ngày)
            </p>
            <Link href="/ads-performance" className="text-xs font-medium text-status-received hover:underline">
              Xem tất cả
            </Link>
          </div>
          {topAds.length === 0 ? (
            <EmptyState icon={Megaphone} title="Chưa có dữ liệu quảng cáo" description="Chưa có liên hệ nào gắn Ad ID trong khoảng thời gian này." />
          ) : (
            <div className="flex flex-col gap-2">
              {topAds.map((ad, i) => (
                <Link
                  key={ad.adId}
                  href={`/ads-performance/${encodeURIComponent(ad.adId)}`}
                  className="shadow-bubble flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition-colors hover:border-status-received/40 hover:bg-status-received-bg/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate max-w-56 font-mono text-xs text-foreground">{ad.adId}</p>
                      <p className="truncate max-w-56 text-xs text-muted-foreground">
                        {ad.sourceName} · {ad.fanpageName}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-foreground">{ad.totalLeads}</p>
                      <p className="text-[11px] text-muted-foreground">liên hệ</p>
                    </div>
                    <ConversionPill rate={ad.conversionRate} />
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {canSeeSaleOps && (
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Users className="size-3.5" />
            Hiệu suất theo Tư vấn viên ({days} ngày)
          </p>
          {salePerf.length === 0 ? (
            <EmptyState icon={Users} title="Chưa có dữ liệu" description="Chưa có Sale nào hoạt động trong khoảng thời gian này." />
          ) : (
            <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                      <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tạo mới</TableHead>
                      <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ tiêu chuẩn</TableHead>
                      <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Spam</TableHead>
                      <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ chuyển đổi</TableHead>
                      <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Số lần chăm sóc</TableHead>
                      <TableHead className="px-4 pr-5 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">TB đủ tiêu chuẩn</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salePerf.map((s) => (
                      <TableRow key={s.email} className="odd:bg-secondary/10">
                        <TableCell className="min-w-40 px-5 py-3.5">
                          <p className="max-w-40 truncate font-medium text-foreground">{s.fullName}</p>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{s.branchName}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-foreground">{s.created}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{s.qualified}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-status-spam">{s.spam}</TableCell>
                        <TableCell className="px-4 text-center">
                          {s.conversionRate != null ? <ConversionPill rate={s.conversionRate} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-muted-foreground">{s.touches}</TableCell>
                        <TableCell className="px-4 pr-5 text-right text-xs text-muted-foreground">
                          {s.avgQualifyHours != null ? `~${Math.round(s.avgQualifyHours)}h` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
