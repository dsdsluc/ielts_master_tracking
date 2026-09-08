"use client";

import { useState } from "react";
import { Megaphone, SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { AdsCostDialog, type AdsCostRow } from "@/app/(app)/ads-cost/ads-cost-dialog";
import { DeleteAdsCostDialog } from "@/app/(app)/ads-cost/delete-ads-cost-dialog";
import { formatDate, formatVnd } from "@/app/(app)/ads-cost/format";

const PAGE_SIZE = 15;

export function AdsCostTable({
  rows,
  branchNames,
  sourceOptions,
  fanpageOptions,
  branchOptions,
  hasFilters = false,
}: {
  rows: AdsCostRow[];
  branchNames: Record<string, string>;
  sourceOptions: string[];
  fanpageOptions: string[];
  branchOptions: { code: string; name: string }[];
  hasFilters?: boolean;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (rows.length === 0) {
    return hasFilters ? (
      <EmptyState
        icon={SearchX}
        title="Không tìm thấy chi phí phù hợp"
        description="Thử đổi từ khoá tìm kiếm hoặc bộ lọc nguồn/cơ sở."
      />
    ) : (
      <EmptyState
        icon={Megaphone}
        title="Chưa có dữ liệu chi phí"
        description="Thêm chi phí quảng cáo theo kỳ để tính hiệu quả trên Dashboard."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{rows.length}</strong> bản ghi
        </p>
        <PaginationBar compact page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Kỳ báo cáo</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên quảng cáo</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Fanpage</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở</TableHead>
              <TableHead className="px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí (VND)</TableHead>
              <TableHead className="w-20 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => (
              <TableRow key={row.id} className="odd:bg-secondary/10">
                <TableCell className="min-w-36 px-5 py-3.5 text-sm text-muted-foreground">
                  {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
                </TableCell>
                <TableCell className="px-4 font-mono text-xs text-foreground">{row.adId}</TableCell>
                <TableCell className="min-w-40 px-4 text-sm text-foreground">
                  <p className="max-w-56 truncate">{row.adName}</p>
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{row.sourceName ?? "—"}</TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground lg:table-cell">
                  <p className="max-w-40 truncate">{row.fanpageName ?? "—"}</p>
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                  {row.branchCode ? (branchNames[row.branchCode] ?? row.branchCode) : "—"}
                </TableCell>
                <TableCell className="px-4 text-right font-mono text-sm text-foreground">{formatVnd(row.costVnd)}</TableCell>
                <TableCell className="pr-4 pl-1">
                  <div className="flex items-center justify-end gap-0.5">
                    <AdsCostDialog
                      mode="edit"
                      row={row}
                      sourceOptions={sourceOptions}
                      fanpageOptions={fanpageOptions}
                      branchOptions={branchOptions}
                    />
                    <DeleteAdsCostDialog id={row.id} adId={row.adId} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
