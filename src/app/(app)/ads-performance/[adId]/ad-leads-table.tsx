"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import type { InteractionListItem } from "@/lib/interactions/types";

const PAGE_SIZE = 15;

export function AdLeadsTable({ items, branchNames }: { items: InteractionListItem[]; branchNames: Record<string, string> }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có liên hệ nào"
        description="Chưa ghi nhận liên hệ nào dùng Ad ID này trong khoảng thời gian đã chọn."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{items.length}</strong> liên hệ
        </p>
        <PaginationBar compact page={page} totalPages={totalPages} totalItems={items.length} onPageChange={setPage} />
      </div>
      <Table>
        <TableHeader className="bg-secondary/60">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Tư vấn viên</TableHead>
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
            <TableHead className="hidden px-4 pr-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Tạo lúc</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedItems.map((item) => (
            <TableRow
              key={item.interactionId}
              className="cursor-pointer odd:bg-secondary/10 hover:bg-status-received-bg/45"
              onClick={() => router.push(`/leads/${item.interactionId}`)}
            >
              <TableCell className="min-w-40 px-5 py-3.5">
                <p className="max-w-56 truncate font-medium text-foreground">{item.customerName}</p>
                <p className="truncate text-xs text-muted-foreground">{item.phoneNormalized ?? "Chưa có SĐT"}</p>
              </TableCell>
              <TableCell className="px-4 text-sm text-muted-foreground">{branchNames[item.assignedBranchCode] ?? item.assignedBranchCode}</TableCell>
              <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                <p className="max-w-40 truncate">{item.consultantName ?? "Chưa gán"}</p>
              </TableCell>
              <TableCell className="px-4">
                <StatusPill status={item.status} />
              </TableCell>
              <TableCell className="hidden px-4 pr-5 text-xs text-muted-foreground lg:table-cell">{formatDateTime(item.createdLeadAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
