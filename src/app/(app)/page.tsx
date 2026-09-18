import Link from "next/link";
import { ChevronRight, Fingerprint, ListPlus, Megaphone, MessageCircleOff, ShieldOff, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessFeature, requireFeatureAccess } from "@/lib/auth/feature-access";
import { INTERACTION_ACTIVITY, ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { computeFunnelSummary, CUSTOMER_STAGE_ORDER } from "@/lib/customers/stats";
import { qualifiedCustomerWhere } from "@/app/(app)/customers/customer-scope";
import { getNewAdIdRows } from "@/lib/marketing/new-ad-ids";
import { cached } from "@/lib/cache";
import { ConversionPill } from "@/app/(app)/ads-performance/ads-performance-table";
import { StageCountStrip } from "@/app/(app)/customers/stage-count-strip";

const WINDOW_DAYS = 30;

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
// (interaction_field_logs, fieldKey=FOLLOWUP_RESOLVED — mốc Sale thực sự xử lý
// xong 1 yêu cầu chăm sóc lại, xem resolveFollowup()/updateStatus() trong
// mutations.ts) và thời gian trung bình từ lúc tạo lead đến lúc đủ tiêu chuẩn
// (không có mốc "liên hệ lần đầu" riêng trong schema nên đây là proxy gần
// nhất cho tốc độ xử lý).
async function computeSalePerformance(
  scope: Prisma.InteractionWhereInput,
  windowStart: Date,
  branchNameByCode: Map<string, string>
): Promise<SalePerfRow[]> {
  const createdWindow = { gte: windowStart };
  const [sales, createdGroups, closedGroups, touchGroups, qualifyRows] = await Promise.all([
    prisma.user.findMany({ where: { role: ROLES.SALES, active: true }, select: { email: true, fullName: true, branchCode: true } }),
    prisma.interaction.groupBy({
      by: ["createdByEmail"],
      where: { ...scope, activeFlag: true, createdLeadAt: createdWindow },
      _count: { _all: true },
    }),
    prisma.interaction.groupBy({
      by: ["updatedByEmail", "statusName"],
      where: {
        ...scope,
        activeFlag: true,
        closedAt: createdWindow,
        statusName: { in: [STATUS.PHONE, STATUS.SPAM] },
        updatedByEmail: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.interactionFieldLog.groupBy({
      by: ["changedByEmail"],
      where: { fieldKey: INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED, changedAt: createdWindow },
      _count: { _all: true },
    }),
    prisma.interaction.findMany({
      where: { ...scope, activeFlag: true, assignedSaleEmail: { not: null }, receivedAt: { not: null }, createdLeadAt: createdWindow },
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
  const touchByEmail = new Map(touchGroups.map((g) => [g.changedByEmail, g._count._all]));

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

function funnelRate(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 1000) / 10}%` : "—";
}

type StageFunnelItem = { label: string; count: number; href: string };

// Khách hàng không có branchCode riêng nên không lọc theo cơ sở (mirror
// computeFunnelSummary() ở lib/customers/stats.ts) — chỉ Leader/Admin gọi,
// vốn đã thấy toàn công ty. Mỗi mốc bấm được, dẫn thẳng sang /customers đã
// lọc sẵn theo đúng mốc đó (xem CustomersPage searchParams.stage).
async function computeStageFunnel(): Promise<StageFunnelItem[]> {
  const groups = await prisma.customer.groupBy({
    by: ["stage"],
    where: qualifiedCustomerWhere(),
    _count: { _all: true },
  });
  const countByStage = new Map(groups.map((g) => [g.stage, g._count._all]));

  return [
    { label: "Chưa gọi", count: countByStage.get(null) ?? 0, href: "/customers?stage=none" },
    ...CUSTOMER_STAGE_ORDER.map((stage) => ({
      label: stage,
      count: countByStage.get(stage) ?? 0,
      href: `/customers?stage=${encodeURIComponent(stage)}`,
    })),
  ];
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "dashboard");

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));
  windowStart.setHours(0, 0, 0, 0);

  const branches = await prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } });
  const branchNameByCode = new Map(branches.map((b) => [b.code, b.name]));

  const scope = branchScopeWhere(user);
  const where: Prisma.InteractionWhereInput = { ...scope, activeFlag: true, createdLeadAt: { gte: windowStart } };

  const cacheKey = `dash:overview:v4:${JSON.stringify(scope)}`;

  // Điều hướng sang router chi tiết /interactions-overview — view QUẢN TRỊ
  // (toàn hệ thống theo scope actor), tách khỏi /leads (công cụ tác nghiệp
  // riêng của Sale) và /customers (khách hàng Đủ tiêu chuẩn đã gộp theo SĐT,
  // không phải danh sách liên hệ thô).
  function pipelineHref(status?: string) {
    return status ? `/interactions-overview?status=${encodeURIComponent(status)}` : "/interactions-overview";
  }

  function salePerformanceHref(email: string) {
    return `/sale-performance/${encodeURIComponent(email)}`;
  }

  const canSeeSaleOps = user.role === ROLES.LEADER || user.role === ROLES.ADMIN;
  const canSeeMarketingOps = user.role === ROLES.MARKETING || user.role === ROLES.ADMIN;

  const rangeLabel = `${WINDOW_DAYS} ngày`;

  // Widget "Cần xử lý" chỉ hiện với vai trò thực sự vào được router tương ứng
  // (xem PERMISSION_FEATURES ở admin/permissions) — Admin luôn thấy, vai trò
  // khác chỉ thấy sau khi được cấp quyền ở /admin/permissions.
  const [canSeeSpamReview, canSeeNewAdIds, canSeeMissingConversation] = await Promise.all([
    canAccessFeature(user, "spamReview"),
    canAccessFeature(user, "newAdIds"),
    canAccessFeature(user, "missingConversation"),
  ]);

  const [kpi, topAds, salePerf, funnel, stageFunnel, spamCount, newAdIdCount, missingConversationCount] = await Promise.all([
    cached(cacheKey, 90, () => computeDashboardKpi(where)),
    canSeeMarketingOps ? cached(`${cacheKey}:top-ads`, 90, () => computeTopAds(where)) : Promise.resolve([]),
    canSeeSaleOps ? cached(`${cacheKey}:sale-perf`, 90, () => computeSalePerformance(scope, windowStart, branchNameByCode)) : Promise.resolve([]),
    canSeeSaleOps ? cached(`${cacheKey}:funnel`, 90, () => computeFunnelSummary(windowStart)) : Promise.resolve({ assigned: 0, enrolled: 0 }),
    canSeeSaleOps ? cached(`${cacheKey}:stage-funnel`, 90, computeStageFunnel) : Promise.resolve([]),
    canSeeSpamReview ? cached("dash:spam-count", 90, () => prisma.interaction.count({ where: { statusName: STATUS.SPAM } })) : Promise.resolve(0),
    canSeeNewAdIds ? cached("dash:new-ad-ids-count", 90, () => getNewAdIdRows().then((rows) => rows.length)) : Promise.resolve(0),
    canSeeMissingConversation
      ? cached("dash:missing-conversation-count", 90, () =>
          prisma.interaction.count({
            where: { activeFlag: true, OR: [{ conversationLink: null }, { conversationLink: "" }], statusName: { not: STATUS.PHONE } },
          })
        )
      : Promise.resolve(0),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Dashboard"
        description="Theo dõi chất lượng nguồn và kết quả chuyển đổi thực tế trong 30 ngày gần nhất."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href={pipelineHref()} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Tổng liên hệ" value={kpi.total} accentClassName="bg-foreground/50" />
        </Link>
        <Link href={pipelineHref(STATUS.PHONE)} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Đủ tiêu chuẩn" value={kpi.qualified} accentClassName="bg-status-qualified" />
        </Link>
        <Link href={pipelineHref(STATUS.PROCESSING)} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Có nhu cầu" value={kpi.processing} accentClassName="bg-status-received" />
        </Link>
        <Link href={pipelineHref(STATUS.SPAM)} className="block rounded-lg transition-shadow hover:shadow-bubble hover:ring-1 hover:ring-status-received/40">
          <KpiCard label="Spam" value={kpi.spam} accentClassName="bg-status-spam" />
        </Link>
      </div>

      {(canSeeSpamReview || canSeeNewAdIds || canSeeMissingConversation) && (
        <div className="mb-6">
          <p className="mb-3 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cần xử lý</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {canSeeSpamReview && (
              <Link
                href="/admin/spam-review"
                className="shadow-bubble flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-status-spam/40 hover:bg-status-spam-bg/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-spam-bg text-status-spam">
                    <ShieldOff className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Xử lý Spam</p>
                    <p className="text-xs text-muted-foreground">{spamCount} liên hệ đang ở trạng thái Spam</p>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
            {canSeeNewAdIds && (
              <Link
                href="/admin/new-ad-ids"
                className="shadow-bubble flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-status-waiting/40 hover:bg-status-waiting-bg/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-waiting-bg text-status-waiting">
                    <ListPlus className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Ad ID mới</p>
                    <p className="text-xs text-muted-foreground">{newAdIdCount} Ad ID chưa có chi phí</p>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
            {canSeeMissingConversation && (
              <Link
                href="/admin/missing-conversation"
                className="shadow-bubble flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-status-received/40 hover:bg-status-received-bg/30"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received">
                    <MessageCircleOff className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Thiếu link hội thoại</p>
                    <p className="text-xs text-muted-foreground">{missingConversationCount} liên hệ chưa Đủ tiêu chuẩn thiếu link</p>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </div>
        </div>
      )}

      {canSeeMarketingOps && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold text-foreground">Phòng Marketing</h2>
          </div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <TrendingUp className="size-3.5" />
              Quảng cáo thu hút nhiều liên hệ nhất ({rangeLabel})
            </p>
            <Link href="/ad-ids" className="flex items-center gap-1 text-xs font-medium text-status-received hover:underline">
              <Fingerprint className="size-3.5" /> Xem toàn bộ Ad ID
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
                      <p className="truncate max-w-56 font-mono text-xs text-foreground" title={ad.adId}>{ad.adId}</p>
                      <p className="truncate max-w-56 text-xs text-muted-foreground" title={`${ad.sourceName} · ${ad.fanpageName}`}>
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
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-status-received" />
          <h2 className="font-heading text-base font-semibold text-foreground">Phòng Sale</h2>
        </div>
      )}

      {canSeeSaleOps && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <TrendingUp className="size-3.5" />
              Toàn phễu: lead → đủ tiêu chuẩn → phân bổ tư vấn → chốt ({rangeLabel})
            </p>
            <Link href="/customers" className="text-xs font-medium text-status-received hover:underline">
              Xem chi tiết tư vấn
            </Link>
          </div>
          <div className="shadow-bubble flex flex-wrap items-stretch gap-2 overflow-hidden rounded-2xl border border-border/70 bg-card p-2">
            {[
              { label: "Lead nhận", value: kpi.total, rate: null },
              { label: "Đủ tiêu chuẩn", value: kpi.qualified, rate: funnelRate(kpi.qualified, kpi.total) },
              { label: "Đã phân bổ tư vấn", value: funnel.assigned, rate: funnelRate(funnel.assigned, kpi.qualified) },
              { label: "Đã chốt", value: funnel.enrolled, rate: funnelRate(funnel.enrolled, funnel.assigned) },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex flex-1 items-center gap-2">
                <div className="flex min-w-32 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2">
                  <span className="font-heading text-xl font-semibold tabular-nums text-foreground">{step.value}</span>
                  <span className="text-xs text-muted-foreground">{step.label}</span>
                  {step.rate && <span className="text-[11px] font-medium text-status-received">{step.rate} bước trước</span>}
                </div>
                {i < arr.length - 1 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              </div>
            ))}
          </div>

          <p className="mt-4 mb-1 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Chi tiết theo mốc tư vấn
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Chia nhỏ đúng nhóm &quot;Đã phân bổ tư vấn&quot; ở trên theo mốc xa nhất Sale đã đạt với từng khách — bấm vào 1 mốc để xem danh sách khách đang ở đó.
          </p>
          <StageCountStrip counts={stageFunnel} />
        </div>
      )}

      {canSeeSaleOps && (
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Users className="size-3.5" />
            Hiệu suất theo Tư vấn viên ({rangeLabel})
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
                      <TableHead className="px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">TB đủ tiêu chuẩn</TableHead>
                      <TableHead className="w-10 pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salePerf.map((s) => (
                      <TableRow key={s.email} className="odd:bg-secondary/10">
                        <TableCell className="min-w-40 px-5 py-3.5">
                          <Link href={salePerformanceHref(s.email)} className="block max-w-40 truncate font-medium text-foreground hover:text-status-received hover:underline" title={s.fullName}>
                            {s.fullName}
                          </Link>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{s.branchName}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-foreground">{s.created}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{s.qualified}</TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-status-spam">{s.spam}</TableCell>
                        <TableCell className="px-4 text-center">
                          {s.conversionRate != null ? <ConversionPill rate={s.conversionRate} /> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-4 text-center font-mono text-sm text-muted-foreground">{s.touches}</TableCell>
                        <TableCell className="px-4 text-right text-xs text-muted-foreground">
                          {s.avgQualifyHours != null ? `~${Math.round(s.avgQualifyHours)}h` : "—"}
                        </TableCell>
                        <TableCell className="pr-5 pl-1 text-right">
                          <Link href={salePerformanceHref(s.email)} aria-label={`Xem chi tiết ${s.fullName}`}>
                            <ChevronRight className="size-4 text-muted-foreground hover:text-foreground" />
                          </Link>
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
