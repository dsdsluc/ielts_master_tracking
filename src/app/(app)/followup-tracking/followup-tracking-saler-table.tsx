import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FollowupSalerSummary } from "@/app/(app)/followup-tracking/stats";

export function FollowupTrackingSalerTable({
  salers,
  detailQuery,
}: {
  salers: FollowupSalerSummary[];
  detailQuery: string;
}) {
  if (salers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có Sale nào được phân chăm sóc lại"
        description="Chưa có yêu cầu chăm sóc lại nào khớp bộ lọc hiện tại."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{salers.length}</strong> Sale được phân chăm sóc lại
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Được giao</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đang chờ</TableHead>
              <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Đã xử lý</TableHead>
              <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Chuyển đổi thật</TableHead>
              <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Spam</TableHead>
              <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">TG xử lý TB</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {salers.map((s) => (
              <TableRow key={s.saleKey} className="odd:bg-secondary/10">
                <TableCell className="min-w-48 px-5 py-3.5">
                  <p className="truncate font-medium text-foreground" title={s.saleName}>{s.saleName}</p>
                  {s.saleKey !== "unassigned" && (
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={s.saleKey}>{s.saleKey}</p>
                  )}
                </TableCell>
                <TableCell className="px-4 text-center font-mono text-sm text-foreground">{s.stats.total}</TableCell>
                <TableCell className="px-4 text-center font-mono text-sm text-status-waiting">{s.stats.pending}</TableCell>
                <TableCell className="hidden px-4 text-center sm:table-cell">
                  <span className="font-mono text-sm text-foreground">{s.stats.resolvedCount}</span>
                  <span className="ml-1 text-xs text-muted-foreground">({s.stats.resolvedRate.toFixed(0)}%)</span>
                </TableCell>
                <TableCell className="hidden px-4 text-center md:table-cell">
                  <span className="font-mono text-sm text-status-qualified">{s.stats.convertedCount}</span>
                  <span className="ml-1 text-xs text-muted-foreground">({s.stats.conversionRate.toFixed(0)}%)</span>
                </TableCell>
                <TableCell className="hidden px-4 text-center font-mono text-sm text-destructive lg:table-cell">
                  {s.stats.spamCount}
                </TableCell>
                <TableCell className="hidden px-4 text-center text-sm text-muted-foreground lg:table-cell">
                  {s.stats.avgResolveLabel}
                </TableCell>
                <TableCell className="pr-4 pl-1">
                  <Link
                    href={`/followup-tracking/${encodeURIComponent(s.saleKey)}${detailQuery}`}
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Xem chi tiết"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
