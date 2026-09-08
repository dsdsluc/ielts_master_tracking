"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatVnd } from "@/app/(app)/ads-cost/format";

export type AdPerfRow = {
  adId: string;
  adName: string | null;
  sourceName: string;
  fanpageName: string;
  totalLeads: number;
  qualified: number;
  spam: number;
  conversionRate: number;
  totalCost: number | null;
  costPerLead: number | null;
};

const PAGE_SIZE = 15;

export function ConversionPill({ rate }: { rate: number }) {
  const style =
    rate >= 30
      ? "bg-status-qualified-bg text-status-qualified"
      : rate >= 10
        ? "bg-status-received-bg text-status-received"
        : "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${style}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

export function AdsPerformanceTable({ rows }: { rows: AdPerfRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Chưa có dữ liệu"
        description="Chưa có liên hệ nào gắn Ad ID trong khoảng thời gian đã chọn."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{rows.length}</strong> quảng cáo
        </p>
        <PaginationBar compact page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[960px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên quảng cáo</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng liên hệ</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ tiêu chuẩn</TableHead>
              <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Spam</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ chuyển đổi</TableHead>
              <TableHead className="hidden px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Chi phí</TableHead>
              <TableHead className="px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">CP/liên hệ</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => (
              <TableRow key={row.adId} className="odd:bg-secondary/10">
                <TableCell className="px-5 py-3.5 font-mono text-xs text-foreground">{row.adId}</TableCell>
                <TableCell className="min-w-40 px-4 text-sm text-foreground">
                  <p className="max-w-56 truncate">{row.adName ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.fanpageName}</p>
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{row.sourceName}</TableCell>
                <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.totalLeads}</TableCell>
                <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{row.qualified}</TableCell>
                <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground sm:table-cell">{row.spam}</TableCell>
                <TableCell className="px-4 text-center">
                  <ConversionPill rate={row.conversionRate} />
                </TableCell>
                <TableCell className="hidden px-4 text-right font-mono text-sm text-muted-foreground lg:table-cell">
                  {row.totalCost != null ? formatVnd(row.totalCost) : "—"}
                </TableCell>
                <TableCell className="px-4 text-right font-mono text-sm text-foreground">
                  {row.costPerLead != null ? formatVnd(Math.round(row.costPerLead)) : "—"}
                </TableCell>
                <TableCell className="pr-4 pl-1">
                  <Link
                    href={`/ads-performance/${encodeURIComponent(row.adId)}`}
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
