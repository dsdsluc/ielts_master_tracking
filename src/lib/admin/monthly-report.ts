import "server-only";
// Báo cáo tổng quan theo tháng cho /admin/monthly-report — gộp lại đúng những
// con số quan trọng nhất đã có sẵn ở các trang khác (phễu liên hệ, phễu tư
// vấn ghi danh, marketing, hiệu suất Sale, chăm sóc lại) thành 1 chỗ duy nhất
// để Admin làm báo cáo/đối chiếu cuối tháng, KHÔNG cần mở từng trang riêng lẻ
// rồi tự cộng lại bằng tay. Luôn tính "sống" từ dữ liệu gốc theo cohort
// NGÀY TẠO (Interaction.createdLeadAt) / NGÀY PHÂN BỔ (Customer.assignedAt) —
// không có khái niệm "chốt số liệu" như /page-report (báo cáo này chỉ để XEM
// lại, không ai cần đóng băng số của quá khứ).
import { prisma } from "@/lib/prisma";
import { SALE_LIKE_ROLES, STATUS, CUSTOMER_STAGE, EXTERNAL_LEAD_FANPAGE } from "@/lib/interactions/constants";
import { getMonthlyKpiTarget } from "@/lib/interactions/settings";
import { monthRange } from "@/lib/customers/stats";
import { computeFollowupStats, groupBySaler, type FollowupStatRow, type FollowupStats, type FollowupSalerSummary } from "@/app/(app)/followup-tracking/stats";
import type { FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";

const CUSTOMER_STAGE_LABELS: { value: string | null; label: string }[] = [
  { value: null, label: "Chưa gọi" },
  ...Object.values(CUSTOMER_STAGE).map((s) => ({ value: s, label: s })),
];

export type LeadFunnel = {
  total: number;
  waiting: number;
  processing: number;
  qualified: number;
  spam: number;
  qualifiedRate: number;
  spamRate: number;
  unresolved: number;
};

export type NamedCount = { key: string; label: string; total: number; qualified: number };

export type StageCount = { stage: string | null; label: string; count: number };

export type SalePerformanceRow = {
  email: string;
  fullName: string;
  created: number;
  qualified: number;
  qualifiedRate: number;
};

export type MonthlyReport = {
  month: string;
  monthLabel: string;
  leadFunnel: LeadFunnel;
  bySource: NamedCount[];
  byBranch: NamedCount[];
  customerFunnel: {
    assignedThisMonth: number;
    stageBreakdown: StageCount[];
    notInterestedCount: number;
    companyTarget: number;
    enrolledThisMonth: number;
    targetProgress: number;
  };
  salePerformance: SalePerformanceRow[];
  marketing: {
    totalAdSpend: number;
    totalLeadsWithAd: number;
    costPerLead: number | null;
    topFanpages: NamedCount[];
  };
  followup: FollowupStats;
};

async function computeLeadFunnelAndBreakdowns(dayStart: Date, dayEnd: Date) {
  const rows = await prisma.interaction.findMany({
    where: { activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
    select: { statusName: true, sourceName: true, fanpageName: true, assignedBranchCode: true, createdByEmail: true, adId: true },
  });

  const total = rows.length;
  const waiting = rows.filter((r) => r.statusName === STATUS.WAITING).length;
  const processing = rows.filter((r) => r.statusName === STATUS.PROCESSING).length;
  const qualified = rows.filter((r) => r.statusName === STATUS.PHONE).length;
  const spam = rows.filter((r) => r.statusName === STATUS.SPAM).length;

  const leadFunnel: LeadFunnel = {
    total,
    waiting,
    processing,
    qualified,
    spam,
    qualifiedRate: total > 0 ? (qualified / total) * 100 : 0,
    spamRate: total > 0 ? (spam / total) * 100 : 0,
    unresolved: waiting + processing,
  };

  function groupCount<K extends "sourceName" | "fanpageName" | "assignedBranchCode">(field: K, excludeKeys: string[] = []) {
    const byKey = new Map<string, { total: number; qualified: number }>();
    for (const r of rows) {
      const key = r[field] as string;
      if (excludeKeys.includes(key)) continue;
      const bucket = byKey.get(key) ?? { total: 0, qualified: 0 };
      bucket.total++;
      if (r.statusName === STATUS.PHONE) bucket.qualified++;
      byKey.set(key, bucket);
    }
    return byKey;
  }

  const bySourceMap = groupCount("sourceName");
  const bySource: NamedCount[] = [...bySourceMap.entries()]
    .map(([key, v]) => ({ key, label: key, total: v.total, qualified: v.qualified }))
    .sort((a, b) => b.total - a.total);

  const byFanpageMap = groupCount("fanpageName");
  const topFanpagesRaw: NamedCount[] = [...byFanpageMap.entries()]
    .map(([key, v]) => ({ key, label: key, total: v.total, qualified: v.qualified }))
    .sort((a, b) => b.total - a.total);

  const totalLeadsWithAd = rows.filter((r) => !!r.adId).length;

  return { leadFunnel, rows, bySource, topFanpagesRaw, totalLeadsWithAd };
}

async function computeByBranch(dayStart: Date, dayEnd: Date): Promise<NamedCount[]> {
  const [rows, branches] = await Promise.all([
    prisma.interaction.groupBy({
      by: ["assignedBranchCode", "statusName"],
      where: { activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
  ]);
  const branchNames = new Map(branches.map((b) => [b.code, b.name]));
  const byCode = new Map<string, { total: number; qualified: number }>();
  for (const r of rows) {
    const bucket = byCode.get(r.assignedBranchCode) ?? { total: 0, qualified: 0 };
    bucket.total += r._count._all;
    if (r.statusName === STATUS.PHONE) bucket.qualified += r._count._all;
    byCode.set(r.assignedBranchCode, bucket);
  }
  return [...byCode.entries()]
    .map(([code, v]) => ({ key: code, label: branchNames.get(code) ?? code, total: v.total, qualified: v.qualified }))
    .sort((a, b) => b.total - a.total);
}

async function computeCustomerFunnel(month: string, dayStart: Date, dayEnd: Date) {
  const [assignedRows, enrolledThisMonth, companyTarget] = await Promise.all([
    prisma.customer.groupBy({
      by: ["stage"],
      where: { assignedAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    }),
    prisma.customer.count({ where: { enrolledAt: { gte: dayStart, lt: dayEnd } } }),
    getMonthlyKpiTarget(month),
  ]);

  const countByStage = new Map(assignedRows.map((r) => [r.stage, r._count._all]));
  const assignedThisMonth = assignedRows.reduce((sum, r) => sum + r._count._all, 0);
  const stageBreakdown: StageCount[] = CUSTOMER_STAGE_LABELS.map(({ value, label }) => ({
    stage: value,
    label,
    count: countByStage.get(value) ?? 0,
  }));
  const notInterestedCount = countByStage.get(CUSTOMER_STAGE.NOT_INTERESTED) ?? 0;

  return {
    assignedThisMonth,
    stageBreakdown,
    notInterestedCount,
    companyTarget,
    enrolledThisMonth,
    targetProgress: companyTarget > 0 ? (enrolledThisMonth / companyTarget) * 100 : 0,
  };
}

async function computeSalePerformance(dayStart: Date, dayEnd: Date): Promise<SalePerformanceRow[]> {
  const [rows, sales] = await Promise.all([
    prisma.interaction.groupBy({
      by: ["createdByEmail", "statusName"],
      where: { activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES } }, select: { email: true, fullName: true } }),
  ]);
  const nameByEmail = new Map(sales.map((s) => [s.email, s.fullName]));
  const byEmail = new Map<string, { created: number; qualified: number }>();
  for (const r of rows) {
    const bucket = byEmail.get(r.createdByEmail) ?? { created: 0, qualified: 0 };
    bucket.created += r._count._all;
    if (r.statusName === STATUS.PHONE) bucket.qualified += r._count._all;
    byEmail.set(r.createdByEmail, bucket);
  }
  return [...byEmail.entries()]
    .map(([email, v]) => ({
      email,
      fullName: nameByEmail.get(email) ?? email,
      created: v.created,
      qualified: v.qualified,
      qualifiedRate: v.created > 0 ? (v.qualified / v.created) * 100 : 0,
    }))
    .sort((a, b) => b.created - a.created);
}

async function computeMarketing(dayStart: Date, dayEnd: Date, topFanpagesRaw: NamedCount[], totalLeadsWithAd: number) {
  const adsCosts = await prisma.adsCost.findMany({
    where: { periodStart: { lt: dayEnd }, periodEnd: { gte: dayStart } },
    select: { costVnd: true },
  });
  const totalAdSpend = adsCosts.reduce((sum, c) => sum + Number(c.costVnd), 0);

  // "Ngoài kênh online" gộp chung Zalo/TikTok/Giới thiệu/Khác — không phải 1
  // Page thật nên tách khỏi bảng xếp hạng Page, hiển thị riêng ở phễu liên hệ
  // (bySource đã có đủ breakdown theo từng Nguồn thật).
  const topFanpages = topFanpagesRaw.filter((f) => f.key !== EXTERNAL_LEAD_FANPAGE).slice(0, 8);

  return {
    totalAdSpend,
    totalLeadsWithAd,
    costPerLead: totalAdSpend > 0 && totalLeadsWithAd > 0 ? totalAdSpend / totalLeadsWithAd : null,
    topFanpages,
  };
}

async function computeFollowupForMonth(dayStart: Date, dayEnd: Date): Promise<FollowupStats> {
  const rows = await prisma.interaction.findMany({
    where: { activeFlag: true, mktPushedAt: { gte: dayStart, lt: dayEnd } },
    select: { needsFollowup: true, followupOutcome: true, statusName: true, followupHandledAt: true, mktPushedAt: true },
  });
  const statRows: FollowupStatRow[] = rows.map((r) => ({
    needsFollowup: r.needsFollowup,
    followupOutcome: r.followupOutcome,
    status: r.statusName,
    followupHandledAt: r.followupHandledAt?.toISOString() ?? null,
    mktPushedAt: r.mktPushedAt!.toISOString(),
  }));
  return computeFollowupStats(statRows);
}

/** Toàn bộ số liệu báo cáo cho 1 tháng — gọi song song mọi nhóm số liệu độc
 * lập với nhau, chỉ phễu Marketing cần đợi kết quả phễu liên hệ (dùng lại
 * topFanpagesRaw/totalLeadsWithAd, tránh quét lại bảng Interaction lần 2). */
export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  const { start: dayStart, end: dayEnd } = monthRange(month);

  const [{ leadFunnel, bySource, topFanpagesRaw, totalLeadsWithAd }, byBranch, customerFunnel, salePerformance, followup] = await Promise.all([
    computeLeadFunnelAndBreakdowns(dayStart, dayEnd),
    computeByBranch(dayStart, dayEnd),
    computeCustomerFunnel(month, dayStart, dayEnd),
    computeSalePerformance(dayStart, dayEnd),
    computeFollowupForMonth(dayStart, dayEnd),
  ]);

  const marketing = await computeMarketing(dayStart, dayEnd, topFanpagesRaw, totalLeadsWithAd);

  return {
    month,
    monthLabel: monthLabel(month),
    leadFunnel,
    bySource,
    byBranch,
    customerFunnel,
    salePerformance,
    marketing,
    followup,
  };
}

// ---------------------------------------------------------------------------
// Trang chi tiết — mỗi trang tổng quan ở trên chỉ đủ để LIẾC qua, các hàm
// dưới đây phục vụ /admin/monthly-report/{sales,leads,marketing,followup}:
// đào sâu đúng 1 khía cạnh, đủ thông tin để trả lời câu hỏi quản trị mà
// không phải mở thêm trang nào khác đi tra cứu.
// ---------------------------------------------------------------------------

export const STAGE_COLUMNS = CUSTOMER_STAGE_LABELS.map((s) => s.label);

export type SaleLeadBreakdown = {
  email: string;
  fullName: string;
  waiting: number;
  processing: number;
  qualified: number;
  spam: number;
  total: number;
  qualifiedRate: number;
};

export type SaleStageBreakdown = {
  email: string;
  fullName: string;
  counts: Record<string, number>;
  total: number;
};

export type SaleActivityDetail = {
  leadCreation: SaleLeadBreakdown[];
  customerStages: SaleStageBreakdown[];
};

/** Hiệu suất Sale đầy đủ: (1) tạo liên hệ mới theo TỪNG trạng thái (không chỉ
 * đủ ĐK/không), (2) khách hàng được phân bổ trong tháng theo TỪNG mốc tư vấn
 * — trả lời trực tiếp "Sale X có đang chăm khách tốt không, khách đang kẹt ở
 * đâu" mà không cần mở /customers rồi tự lọc/đếm tay. Liệt kê MỌI Sale đang
 * hoạt động (kể cả 0 hoạt động trong tháng) để lộ luôn ai không làm gì. */
export async function getSaleActivityDetail(month: string): Promise<SaleActivityDetail> {
  const { start: dayStart, end: dayEnd } = monthRange(month);

  const [sales, leadRows, stageRows] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES } }, select: { email: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.interaction.groupBy({
      by: ["createdByEmail", "statusName"],
      where: { activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
      _count: { _all: true },
    }),
    prisma.customer.groupBy({
      by: ["assignedToEmail", "stage"],
      where: { assignedAt: { gte: dayStart, lt: dayEnd }, assignedToEmail: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const nameByEmail = new Map(sales.map((s) => [s.email, s.fullName]));
  const leadByEmail = new Map<string, { waiting: number; processing: number; qualified: number; spam: number }>();
  for (const r of leadRows) {
    const bucket = leadByEmail.get(r.createdByEmail) ?? { waiting: 0, processing: 0, qualified: 0, spam: 0 };
    if (r.statusName === STATUS.WAITING) bucket.waiting += r._count._all;
    else if (r.statusName === STATUS.PROCESSING) bucket.processing += r._count._all;
    else if (r.statusName === STATUS.PHONE) bucket.qualified += r._count._all;
    else if (r.statusName === STATUS.SPAM) bucket.spam += r._count._all;
    leadByEmail.set(r.createdByEmail, bucket);
  }

  const stageByEmail = new Map<string, Record<string, number>>();
  for (const r of stageRows) {
    const email = r.assignedToEmail as string;
    const label = CUSTOMER_STAGE_LABELS.find((s) => s.value === r.stage)?.label ?? (r.stage ?? "Chưa gọi");
    const record = stageByEmail.get(email) ?? {};
    record[label] = (record[label] ?? 0) + r._count._all;
    stageByEmail.set(email, record);
  }

  // Sale nào chỉ xuất hiện ở 1 trong 2 tập (tạo lead nhưng không được giao
  // khách, hoặc ngược lại) vẫn phải liệt kê đủ — hợp cả 3 nguồn email lại.
  const allEmails = new Set<string>([...sales.map((s) => s.email), ...leadByEmail.keys(), ...stageByEmail.keys()]);

  const leadCreation: SaleLeadBreakdown[] = [...allEmails]
    .map((email) => {
      const b = leadByEmail.get(email) ?? { waiting: 0, processing: 0, qualified: 0, spam: 0 };
      const total = b.waiting + b.processing + b.qualified + b.spam;
      return {
        email,
        fullName: nameByEmail.get(email) ?? email,
        ...b,
        total,
        qualifiedRate: total > 0 ? (b.qualified / total) * 100 : 0,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const customerStages: SaleStageBreakdown[] = [...allEmails]
    .map((email) => {
      const counts = stageByEmail.get(email) ?? {};
      const total = Object.values(counts).reduce((sum, v) => sum + v, 0);
      return { email, fullName: nameByEmail.get(email) ?? email, counts, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  return { leadCreation, customerStages };
}

export type StatusBreakdownRow = {
  key: string;
  label: string;
  waiting: number;
  processing: number;
  qualified: number;
  spam: number;
  total: number;
};

export type DayCount = { date: string; total: number; qualified: number };

export type LeadFunnelDetail = {
  bySource: StatusBreakdownRow[];
  byBranch: StatusBreakdownRow[];
  daily: DayCount[];
};

function toStatusBreakdown(byKey: Map<string, { waiting: number; processing: number; qualified: number; spam: number }>, labelFor: (key: string) => string): StatusBreakdownRow[] {
  return [...byKey.entries()]
    .map(([key, b]) => ({ key, label: labelFor(key), ...b, total: b.waiting + b.processing + b.qualified + b.spam }))
    .sort((a, b) => b.total - a.total);
}

/** Đào sâu phễu liên hệ: theo Nguồn và Cơ sở tách RÕ từng trạng thái (không
 * gộp mỗi "đủ ĐK" như bảng tổng quan), cộng thêm xu hướng theo từng ngày
 * trong tháng — đủ để nhận ra ngày/đợt nào phát sinh bất thường. */
export async function getLeadFunnelDetail(month: string): Promise<LeadFunnelDetail> {
  const { start: dayStart, end: dayEnd } = monthRange(month);
  const [rows, branches] = await Promise.all([
    prisma.interaction.findMany({
      where: { activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
      select: { statusName: true, sourceName: true, assignedBranchCode: true, createdLeadAt: true },
    }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
  ]);
  const branchNames = new Map(branches.map((b) => [b.code, b.name]));

  function bump(map: Map<string, { waiting: number; processing: number; qualified: number; spam: number }>, key: string, status: string) {
    const bucket = map.get(key) ?? { waiting: 0, processing: 0, qualified: 0, spam: 0 };
    if (status === STATUS.WAITING) bucket.waiting++;
    else if (status === STATUS.PROCESSING) bucket.processing++;
    else if (status === STATUS.PHONE) bucket.qualified++;
    else if (status === STATUS.SPAM) bucket.spam++;
    map.set(key, bucket);
  }

  const bySourceMap = new Map<string, { waiting: number; processing: number; qualified: number; spam: number }>();
  const byBranchMap = new Map<string, { waiting: number; processing: number; qualified: number; spam: number }>();
  const byDay = new Map<string, { total: number; qualified: number }>();

  for (const r of rows) {
    bump(bySourceMap, r.sourceName, r.statusName);
    bump(byBranchMap, r.assignedBranchCode, r.statusName);

    const day = r.createdLeadAt.toISOString().slice(0, 10);
    const dBucket = byDay.get(day) ?? { total: 0, qualified: 0 };
    dBucket.total++;
    if (r.statusName === STATUS.PHONE) dBucket.qualified++;
    byDay.set(day, dBucket);
  }

  const daily: DayCount[] = [...byDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    bySource: toStatusBreakdown(bySourceMap, (k) => k),
    byBranch: toStatusBreakdown(byBranchMap, (k) => branchNames.get(k) ?? k),
    daily,
  };
}

export type AdPerfDetailRow = {
  adId: string;
  adName: string | null;
  sourceName: string;
  fanpageName: string;
  total: number;
  qualified: number;
  cost: number | null;
  costPerLead: number | null;
};

export type SourceSpend = { sourceName: string; cost: number };

export type MarketingDetail = {
  adRows: AdPerfDetailRow[];
  bySourceSpend: SourceSpend[];
  allFanpages: NamedCount[];
};

/** Đào sâu Marketing: hiệu quả theo TỪNG Ad ID (không chỉ gộp theo Page), chi
 * phí theo Nguồn, và danh sách ĐẦY ĐỦ mọi Page (kể cả "Ngoài kênh online",
 * bảng tổng quan cố tình lược bớt 2 chỗ này cho gọn). */
export async function getMarketingDetail(month: string): Promise<MarketingDetail> {
  const { start: dayStart, end: dayEnd } = monthRange(month);
  const [rows, adsCosts] = await Promise.all([
    prisma.interaction.findMany({
      where: { activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
      select: { adId: true, statusName: true, sourceName: true, fanpageName: true },
    }),
    prisma.adsCost.findMany({
      where: { periodStart: { lt: dayEnd }, periodEnd: { gte: dayStart } },
      select: { adId: true, adName: true, sourceName: true, costVnd: true },
    }),
  ]);

  const byAd = new Map<string, { total: number; qualified: number; sourceName: string; fanpageName: string }>();
  const byFanpage = new Map<string, { total: number; qualified: number }>();
  for (const r of rows) {
    const fBucket = byFanpage.get(r.fanpageName) ?? { total: 0, qualified: 0 };
    fBucket.total++;
    if (r.statusName === STATUS.PHONE) fBucket.qualified++;
    byFanpage.set(r.fanpageName, fBucket);

    if (!r.adId) continue;
    const aBucket = byAd.get(r.adId) ?? { total: 0, qualified: 0, sourceName: r.sourceName, fanpageName: r.fanpageName };
    aBucket.total++;
    if (r.statusName === STATUS.PHONE) aBucket.qualified++;
    byAd.set(r.adId, aBucket);
  }

  const costByAd = new Map<string, { adName: string; cost: number }>();
  const spendBySource = new Map<string, number>();
  for (const c of adsCosts) {
    const existing = costByAd.get(c.adId) ?? { adName: c.adName, cost: 0 };
    existing.cost += Number(c.costVnd);
    existing.adName = c.adName;
    costByAd.set(c.adId, existing);

    const sourceKey = c.sourceName ?? "Chưa gán Nguồn";
    spendBySource.set(sourceKey, (spendBySource.get(sourceKey) ?? 0) + Number(c.costVnd));
  }

  const adRows: AdPerfDetailRow[] = [...byAd.entries()]
    .map(([adId, b]) => {
      const cost = costByAd.get(adId);
      return {
        adId,
        adName: cost?.adName ?? null,
        sourceName: b.sourceName,
        fanpageName: b.fanpageName,
        total: b.total,
        qualified: b.qualified,
        cost: cost?.cost ?? null,
        costPerLead: cost && cost.cost > 0 ? cost.cost / b.total : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  const allFanpages: NamedCount[] = [...byFanpage.entries()]
    .map(([key, v]) => ({ key, label: key, total: v.total, qualified: v.qualified }))
    .sort((a, b) => b.total - a.total);

  const bySourceSpend: SourceSpend[] = [...spendBySource.entries()]
    .map(([sourceName, cost]) => ({ sourceName, cost }))
    .sort((a, b) => b.cost - a.cost);

  return { adRows, bySourceSpend, allFanpages };
}

export type FollowupDetail = {
  overall: FollowupStats;
  salerSummaries: FollowupSalerSummary[];
};

/** Đào sâu Chăm sóc lại: hiệu suất xử lý theo TỪNG Sale được giao trong
 * tháng (đã có sẵn logic ở /followup-tracking, tái dùng nguyên groupBySaler
 * thay vì viết lại) — trả lời "Sale nào đang ôm nhiều yêu cầu chưa xử lý". */
export async function getFollowupDetail(month: string): Promise<FollowupDetail> {
  const { start: dayStart, end: dayEnd } = monthRange(month);
  const rows = await prisma.interaction.findMany({
    where: { activeFlag: true, mktPushedAt: { gte: dayStart, lt: dayEnd } },
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
    resolveNote: null,
  }));

  return {
    overall: computeFollowupStats(tableRows),
    salerSummaries: groupBySaler(tableRows),
  };
}
