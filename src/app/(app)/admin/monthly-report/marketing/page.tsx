import { Fingerprint, Megaphone, Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { getMarketingDetail } from "@/lib/admin/monthly-report";
import { formatVnd } from "@/app/(app)/ads-cost/format";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";
import { DetailMonthNav } from "@/app/(app)/admin/monthly-report/detail-month-nav";

const MONTH_RE = /^\d{4}-\d{2}$/;

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default async function MarketingDetailPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "monthlyReport");

  const { month: monthParam } = await searchParams;
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : currentKpiMonth();

  const { adRows, bySourceSpend, allFanpages } = await getMarketingDetail(month);

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Chi tiết Marketing"
        description={`${monthLabel(month)} — hiệu quả theo từng Ad ID, chi phí theo Nguồn, và toàn bộ Page có phát sinh liên hệ.`}
        action={<DetailMonthNav month={month} basePath="/admin/monthly-report/marketing" />}
      />

      <section className="mb-10">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Fingerprint className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Hiệu quả theo Ad ID</h2>
            <p className="text-xs text-muted-foreground">Chi phí tính theo kỳ báo cáo trùng với tháng đang xem — quảng cáo chưa ghi nhận chi phí sẽ để trống CP/liên hệ.</p>
          </div>
        </div>
        {adRows.length === 0 ? (
          <EmptyState icon={Fingerprint} title="Chưa có liên hệ nào gắn Ad ID trong tháng" description="Số liệu sẽ xuất hiện khi có liên hệ mới từ quảng cáo." />
        ) : (
          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader className="bg-secondary/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên quảng cáo</TableHead>
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn / Page</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Liên hệ</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ ĐK</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">CP/liên hệ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adRows.map((r) => (
                    <TableRow key={r.adId} className="odd:bg-secondary/10">
                      <TableCell className="px-5 py-2.5 font-mono text-sm text-foreground">{r.adId}</TableCell>
                      <TableCell className="max-w-40 truncate px-4 py-2.5 text-sm text-foreground" title={r.adName ?? undefined}>
                        {r.adName ?? <span className="text-muted-foreground">Chưa có tên</span>}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                        {r.sourceName} · {r.fanpageName}
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{r.total}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{r.qualified}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{r.cost != null ? formatVnd(r.cost) : "—"}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">
                        {r.costPerLead != null ? formatVnd(Math.round(r.costPerLead)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Chi phí theo Nguồn</h2>
          </div>
          {bySourceSpend.length === 0 ? (
            <p className="rounded-2xl border border-border/70 bg-card px-4 py-6 text-center text-xs text-muted-foreground">
              Chưa có chi phí quảng cáo nào ghi nhận cho kỳ trùng tháng này.
            </p>
          ) : (
            <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn</TableHead>
                    <TableHead className="px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySourceSpend.map((s) => (
                    <TableRow key={s.sourceName} className="odd:bg-secondary/10">
                      <TableCell className="px-4 py-2.5 text-sm text-foreground">{s.sourceName}</TableCell>
                      <TableCell className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{formatVnd(s.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Toàn bộ Page</h2>
          </div>
          {allFanpages.length === 0 ? (
            <p className="rounded-2xl border border-border/70 bg-card px-4 py-6 text-center text-xs text-muted-foreground">Chưa có liên hệ nào trong tháng.</p>
          ) : (
            <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Page</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ ĐK</TableHead>
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFanpages.map((f) => (
                    <TableRow key={f.key} className="odd:bg-secondary/10">
                      <TableCell className="max-w-40 truncate px-4 py-2.5 text-sm text-foreground" title={f.label}>{f.label}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{f.total}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{f.qualified}</TableCell>
                      <TableCell className="px-4 font-mono text-xs text-muted-foreground">{f.total > 0 ? pct((f.qualified / f.total) * 100) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
