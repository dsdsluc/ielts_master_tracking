"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";

export type ClosedReportRow = {
  reportDate: string;
  fanpageName: string;
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  closedAt: string;
  closedByName: string | null;
};

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ConversionPill({ rate }: { rate: number }) {
  const style =
    rate >= 30
      ? "bg-status-qualified-bg text-status-qualified"
      : rate >= 10
        ? "bg-status-received-bg text-status-received"
        : "bg-secondary text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${style}`}>{rate.toFixed(1)}%</span>;
}

export function ClosedReportsTable({ items }: { items: ClosedReportRow[] }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{items.length}</strong> báo cáo đã chốt
        </p>
        <PaginationBar compact page={page} totalPages={totalPages} totalItems={items.length} onPageChange={setPage} />
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ngày báo cáo</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Page</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tin nhắn nhận được</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách xin SĐT</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ chuyển đổi</TableHead>
              <TableHead className="px-4 pr-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chốt bởi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((row) => (
              <TableRow
                key={`${row.reportDate}-${row.fanpageName}`}
                className="cursor-pointer odd:bg-secondary/10 hover:bg-status-received-bg/45"
                onClick={() => router.push(`/page-report?date=${row.reportDate.slice(0, 10)}`)}
              >
                <TableCell className="px-5 py-3.5 text-sm text-foreground">{formatDate(row.reportDate)}</TableCell>
                <TableCell className="px-4 py-3.5 text-sm text-foreground">
                  <p className="max-w-48 truncate">{row.fanpageName}</p>
                </TableCell>
                <TableCell className="px-4 py-3.5 text-center font-mono text-sm text-foreground">{row.totalLeads}</TableCell>
                <TableCell className="px-4 py-3.5 text-center font-mono text-sm text-status-qualified">{row.qualifiedLeads}</TableCell>
                <TableCell className="px-4 py-3.5 text-center">
                  <ConversionPill rate={row.conversionRate} />
                </TableCell>
                <TableCell className="px-4 py-3.5 pr-5 text-xs text-muted-foreground">
                  <p className="max-w-40 truncate text-sm text-foreground">{row.closedByName ?? "—"}</p>
                  <p>{formatDateTime(row.closedAt)}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
