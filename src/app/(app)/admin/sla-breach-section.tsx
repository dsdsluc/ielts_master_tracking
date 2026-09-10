"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, TimerOff } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import type { InteractionListItem } from "@/lib/interactions/types";

const PAGE_SIZE = 10;

export function SlaBreachSection({ items, branchNames }: { items: InteractionListItem[]; branchNames: Record<string, string> }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-waiting-bg text-status-waiting">
          <TimerOff className="size-4" />
        </span>
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-foreground">Lead bị bỏ quên / quá SLA — toàn hệ thống</h2>
          <p className="text-xs text-muted-foreground">Gộp từ mọi cơ sở, không riêng 1 Sale nào</p>
        </div>
        <PaginationBar compact page={page} totalPages={totalPages} totalItems={items.length} onPageChange={setPage} />
        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={TimerOff} title="Không có lead nào quá SLA" description="Mọi cơ sở đang xử lý đúng hạn." />
      ) : (
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Tư vấn viên</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Tạo lúc</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((item) => (
              <TableRow key={item.interactionId} className="odd:bg-secondary/10">
                <TableCell className="min-w-40 px-5 py-3.5">
                  <p className="truncate font-medium text-foreground">{item.customerName}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.fanpageName}</p>
                </TableCell>
                <TableCell className="px-4 text-sm text-muted-foreground">{branchNames[item.assignedBranchCode] ?? item.assignedBranchCode}</TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{item.consultantName ?? "Chưa gán"}</TableCell>
                <TableCell className="px-4">
                  <StatusPill status={item.status} />
                </TableCell>
                <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">{formatDateTime(item.createdLeadAt)}</TableCell>
                <TableCell className="pr-4 pl-1">
                  <Link href={`/leads/${item.interactionId}`} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Xem chi tiết">
                    <ChevronRight className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
