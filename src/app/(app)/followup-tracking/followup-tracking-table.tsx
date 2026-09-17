"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { FOLLOWUP_OUTCOME, STATUS } from "@/lib/interactions/constants";
import { FollowupResultReviewDialog } from "@/app/(app)/followup-tracking/followup-result-review-dialog";

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
  followupOutcome: string | null;
  followupResolvedCount: number;
  saleEmail: string | null;
  saleName: string | null;
  /** Nội dung Sale ghi lại khi "Đánh dấu đã xử lý" hoặc khi đổi trạng thái lúc
   * đang có yêu cầu chăm sóc lại — null nếu chưa xử lý hoặc không tìm được log. */
  resolveNote: string | null;
};

const PAGE_SIZE = 15;

export function ResolvedPill({ pending, outcome, status }: { pending: boolean; outcome: string | null; status: string }) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-waiting-bg px-2.5 py-0.5 text-xs font-medium text-status-waiting">
        <span className="size-1.5 rounded-full bg-current" />
        Đang chờ xử lý
      </span>
    );
  }
  if (status === STATUS.SPAM) {
    const isAuto = outcome === FOLLOWUP_OUTCOME.MANUAL_DISMISS;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
        <span className="size-1.5 rounded-full bg-current" />
        {isAuto ? "Spam (tự động — quá số lần)" : "Spam (Sale đóng)"}
      </span>
    );
  }
  const isRealChange = outcome === FOLLOWUP_OUTCOME.STATUS_CHANGED;
  const style = isRealChange ? "bg-status-qualified-bg text-status-qualified" : "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {isRealChange ? "Đổi trạng thái" : "Đóng thủ công"}
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
  const [selected, setSelected] = useState<FollowupTrackingRow | null>(null);
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
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Xử lý</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ghi chú xử lý</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Số lần</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Thời gian xử lý</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => (
              <TableRow
                key={row.interactionId}
                className="cursor-pointer odd:bg-secondary/10 hover:bg-secondary/40"
                onClick={() => setSelected(row)}
              >
                <TableCell className="min-w-40 px-5 py-3.5">
                  <p className="truncate font-medium text-foreground" title={row.customerName}>{row.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground" title={`Gửi lúc ${formatDateTime(row.mktPushedAt)}`}>Gửi lúc {formatDateTime(row.mktPushedAt)}</p>
                  {row.mktSuggestion && <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground" title={`Gợi ý: ${row.mktSuggestion}`}>Gợi ý: {row.mktSuggestion}</p>}
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                  {branchNames[row.assignedBranchCode] ?? row.assignedBranchCode}
                </TableCell>
                <TableCell className="px-4">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="px-4">
                  <ResolvedPill pending={row.needsFollowup} outcome={row.followupOutcome} status={row.status} />
                  {!row.needsFollowup && row.followupHandledByName && (
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={`bởi ${row.followupHandledByName}`}>bởi {row.followupHandledByName}</p>
                  )}
                </TableCell>
                <TableCell className="px-4 text-sm text-muted-foreground">
                  <p className="max-w-64 whitespace-pre-wrap">{row.resolveNote ?? "—"}</p>
                </TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{row.followupResolvedCount}</TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground lg:table-cell">
                  {row.followupHandledAt ? formatDuration(row.mktPushedAt, row.followupHandledAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FollowupResultReviewDialog
        row={selected}
        branchName={selected ? (branchNames[selected.assignedBranchCode] ?? selected.assignedBranchCode) : ""}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
