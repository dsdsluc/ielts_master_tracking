import type { KpiPeriod, SalePersonalKpi } from "@/lib/students/stats";

function formatKpiMonth(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

function PeriodRow({ label, period }: { label: string; period: KpiPeriod }) {
  const denominator = Math.max(period.target, period.achieved, 1);
  const progressPercent = Math.min(100, Math.round((period.achieved / denominator) * 100));
  const reached = period.achieved >= period.target;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground">
          <strong className="font-mono">{period.achieved}</strong>
          <span className="text-muted-foreground"> / {period.target} người</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-status-qualified" : "bg-status-received"}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export function WorkspaceKpiCard({ kpi }: { kpi: SalePersonalKpi }) {
  if (kpi.mineAssigned === 0) {
    return (
      <div className="shadow-bubble mb-6 rounded-2xl border border-border/70 bg-card p-5">
        <p className="font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Chỉ tiêu cá nhân tháng {formatKpiMonth(kpi.month)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Chưa được phân bổ học viên nào trong tháng này nên chưa có chỉ tiêu cụ thể.
        </p>
      </div>
    );
  }

  const sharePercent = kpi.totalAssigned > 0 ? Math.round((kpi.mineAssigned / kpi.totalAssigned) * 1000) / 10 : 0;

  return (
    <div className="shadow-bubble mb-6 rounded-2xl border border-border/70 bg-card p-5">
      <p className="mb-4 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Chỉ tiêu cá nhân tháng {formatKpiMonth(kpi.month)}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <PeriodRow label="Hôm nay cần chốt thêm" period={kpi.daily} />
        <PeriodRow label="Tuần này cần chốt thêm" period={kpi.weekly} />
        <PeriodRow label="Cả tháng" period={kpi.monthly} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Được phân bổ <strong className="font-mono text-foreground">{kpi.mineAssigned}</strong>/{kpi.totalAssigned} học viên toàn công ty tháng này (
        {sharePercent}%) — chỉ tiêu tháng của bạn = chỉ tiêu công ty × tỷ lệ nhận ={" "}
        {kpi.companyTarget} × {sharePercent}% ≈ <strong className="font-mono text-foreground">{kpi.monthly.target}</strong>. Chỉ tiêu ngày/tuần tự
        tính lại theo phần còn thiếu và số ngày/tuần còn lại trong tháng.
      </p>
    </div>
  );
}
