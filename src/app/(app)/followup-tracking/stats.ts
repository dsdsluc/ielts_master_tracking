import { FOLLOWUP_OUTCOME, STATUS } from "@/lib/interactions/constants";
import type { FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";

export type FollowupStats = {
  total: number;
  pending: number;
  resolvedCount: number;
  resolvedRate: number;
  convertedCount: number;
  conversionRate: number;
  spamCount: number;
  spamRate: number;
  manualDismissCount: number;
  avgResolveHours: number | null;
  avgResolveLabel: string;
};

/** Tính KPI chăm sóc lại từ 1 tập FollowupTrackingRow — dùng chung cho KPI
 * tổng ở trang /followup-tracking, từng nhóm Sale trên bảng tổng hợp, và KPI
 * ở trang chi tiết theo Sale, để 3 nơi luôn khớp công thức nhau. */
export function computeFollowupStats(rows: FollowupTrackingRow[]): FollowupStats {
  const total = rows.length;
  const pending = rows.filter((r) => r.needsFollowup).length;
  const resolvedCount = total - pending;
  const resolvedRate = total > 0 ? (resolvedCount / total) * 100 : 0;
  // Chuyển đổi thật = có đổi trạng thái nghiệp vụ sau khi được nhắc (không phải
  // chỉ bấm "đã xử lý") VÀ trạng thái hiện tại là "Đủ tiêu chuẩn" (đã lấy SĐT).
  const convertedCount = rows.filter(
    (r) => r.followupOutcome === FOLLOWUP_OUTCOME.STATUS_CHANGED && r.status === STATUS.PHONE
  ).length;
  const conversionRate = total > 0 ? (convertedCount / total) * 100 : 0;
  const spamCount = rows.filter((r) => r.status === STATUS.SPAM).length;
  const spamRate = total > 0 ? (spamCount / total) * 100 : 0;
  const manualDismissCount = rows.filter(
    (r) => r.followupOutcome === FOLLOWUP_OUTCOME.MANUAL_DISMISS && r.status !== STATUS.SPAM
  ).length;
  const resolvedDurationsHours = rows
    .filter((r) => r.followupHandledAt)
    .map((r) => (new Date(r.followupHandledAt as string).getTime() - new Date(r.mktPushedAt).getTime()) / 3600000);
  const avgResolveHours =
    resolvedDurationsHours.length > 0
      ? resolvedDurationsHours.reduce((a, b) => a + b, 0) / resolvedDurationsHours.length
      : null;
  const avgResolveLabel =
    avgResolveHours == null ? "—" : avgResolveHours < 24 ? `${Math.round(avgResolveHours)} giờ` : `${(avgResolveHours / 24).toFixed(1)} ngày`;

  return {
    total,
    pending,
    resolvedCount,
    resolvedRate,
    convertedCount,
    conversionRate,
    spamCount,
    spamRate,
    manualDismissCount,
    avgResolveHours,
    avgResolveLabel,
  };
}

export type FollowupSalerSummary = {
  /** Email của Sale, hoặc "unassigned" cho các liên hệ đã gắn cờ nhưng chưa
   * gán Sale cụ thể (case cũ trước khi có followupTargetSaleEmail). */
  saleKey: string;
  saleName: string;
  stats: FollowupStats;
};

const UNASSIGNED_KEY = "unassigned";

export function groupBySaler(rows: FollowupTrackingRow[]): FollowupSalerSummary[] {
  const bySaler = new Map<string, FollowupTrackingRow[]>();
  for (const row of rows) {
    const key = row.saleEmail ?? UNASSIGNED_KEY;
    const list = bySaler.get(key);
    if (list) list.push(row);
    else bySaler.set(key, [row]);
  }

  return Array.from(bySaler.entries())
    .map(([saleKey, groupRows]) => ({
      saleKey,
      saleName: saleKey === UNASSIGNED_KEY ? "Chưa gán Sale" : (groupRows[0].saleName ?? saleKey),
      stats: computeFollowupStats(groupRows),
    }))
    .sort((a, b) => {
      if (a.saleKey === UNASSIGNED_KEY) return 1;
      if (b.saleKey === UNASSIGNED_KEY) return -1;
      return b.stats.total - a.stats.total;
    });
}
