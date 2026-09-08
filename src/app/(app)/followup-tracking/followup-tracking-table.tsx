"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";

export type FollowupTrackingRow = {
  interactionId: string;
  customerName: string;
  status: string;
  assignedBranchCode: string;
  mktSuggestion: string | null;
  mktPushedAt: string;
  mktPushedByName: string | null;
  needsFollowup: boolean;
  followupHandledAt: string | null;
  followupHandledByName: string | null;
};

const PAGE_SIZE = 15;

function ResolvedPill({ pending }: { pending: boolean }) {
  const style = pending ? "bg-status-waiting-bg text-status-waiting" : "bg-status-qualified-bg text-status-qualified";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {pending ? "Đang chờ xử lý" : "Đã xử lý"}
    </span>
  );
}

function formatDuration(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = ms / 3600000;
  if (hours < 24) return `${Math.max(1, Math.round(hours))} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

export function FollowupTrackingTable({ rows, branchNames }: { rows: FollowupTrackingRow[]; branchNames: Record<string, string> }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Chưa có yêu cầu chăm sóc lại nào"
        description="Chưa có liên hệ nào được gắn cờ chăm sóc lại khớp bộ lọc hiện tại."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{rows.length}</strong> yêu cầu
        </p>
        <PaginationBar compact page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái liên hệ</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Gợi ý đã gửi</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Gửi lúc</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Xử lý</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Thời gian xử lý</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => (
              <TableRow key={row.interactionId} className="odd:bg-secondary/10">
                <TableCell className="min-w-40 px-5 py-3.5">
                  <p className="truncate font-medium text-foreground">{row.customerName}</p>
                  {row.mktPushedByName && <p className="truncate text-xs text-muted-foreground">Gửi bởi {row.mktPushedByName}</p>}
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                  {branchNames[row.assignedBranchCode] ?? row.assignedBranchCode}
                </TableCell>
                <TableCell className="px-4">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground lg:table-cell">
                  <p className="max-w-56 truncate">{row.mktSuggestion ?? "—"}</p>
                </TableCell>
                <TableCell className="hidden px-4 text-xs text-muted-foreground md:table-cell">{formatDateTime(row.mktPushedAt)}</TableCell>
                <TableCell className="px-4">
                  <ResolvedPill pending={row.needsFollowup} />
                  {!row.needsFollowup && row.followupHandledByName && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">bởi {row.followupHandledByName}</p>
                  )}
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground lg:table-cell">
                  {row.followupHandledAt ? formatDuration(row.mktPushedAt, row.followupHandledAt) : "—"}
                </TableCell>
                <TableCell className="pr-4 pl-1">
                  <Link href={`/leads/${row.interactionId}`} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Xem chi tiết">
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
