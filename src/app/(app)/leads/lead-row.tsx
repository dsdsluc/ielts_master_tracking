"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, LoaderCircle, MessageCircleMore, Search } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InteractionListItem } from "@/app/(app)/leads/types";

export type LeadsSort = {
  key: "customer" | "createdAt";
  direction: "asc" | "desc";
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadRow({
  item,
  onOpen,
  isSample = false,
  currentUserEmail,
}: {
  item: InteractionListItem;
  onOpen: (id: string) => void;
  isSample?: boolean;
  currentUserEmail: string;
}) {
  const isMine = item.consultantEmail === currentUserEmail;

  function handleActivate() {
    if (isSample) return;
    onOpen(item.interactionId);
  }

  return (
    <TableRow
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (!isSample && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleActivate();
        }
      }}
      tabIndex={isSample ? -1 : 0}
      aria-label={isSample ? `Dữ liệu mẫu: ${item.customerName}` : `Mở liên hệ của ${item.customerName}`}
      className="group cursor-pointer outline-none odd:bg-secondary/10 hover:bg-status-received-bg/45 focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <TableCell className="min-w-56 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received transition-colors group-hover:bg-status-received group-hover:text-white">
            <MessageCircleMore className="size-3.5" />
          </span>
          <span className="min-w-0 max-w-48 flex-1 truncate font-medium text-foreground" title={item.customerName}>{item.customerName}</span>
        </div>
        <p className="mt-1 truncate pl-10 text-xs text-muted-foreground sm:hidden" title={`${item.fanpageName} · ${formatDate(item.createdLeadAt)}`}>
          {item.fanpageName} · {formatDate(item.createdLeadAt)}
        </p>
      </TableCell>
      <TableCell className="hidden max-w-56 px-4 text-muted-foreground sm:table-cell">
        <p className="truncate font-medium text-foreground/80" title={item.fanpageName}>{item.fanpageName}</p>
        <p className="mt-0.5 truncate text-xs" title={item.sourceName}>{item.sourceName}</p>
      </TableCell>
      <TableCell className="hidden px-4 text-muted-foreground lg:table-cell" onClick={(e) => e.stopPropagation()}>
        {isMine ? (
          <p className="max-w-32 truncate font-medium text-status-received">Bạn</p>
        ) : (
          item.consultantName ? <p className="max-w-32 truncate" title={item.consultantName}>{item.consultantName}</p> : <span className="text-muted-foreground">Chưa gán</span>
        )}
      </TableCell>
      <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">
        {formatDate(item.createdLeadAt)}
      </TableCell>
      <TableCell className="px-4"><StatusPill status={item.status} /></TableCell>
      <TableCell className="w-10 pr-4 pl-1 text-right">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </TableCell>
    </TableRow>
  );
}

export function LeadsTable({
  items,
  totalItems,
  onOpen,
  isSample = false,
  currentUserEmail,
  search,
  onSearchChange,
  sort,
  onSortChange,
  refreshing = false,
  pagination,
}: {
  items: InteractionListItem[];
  totalItems: number;
  onOpen: (id: string) => void;
  isSample?: boolean;
  currentUserEmail: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  sort: LeadsSort;
  onSortChange: (sort: LeadsSort) => void;
  refreshing?: boolean;
  pagination?: { page: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void };
}) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/70 bg-card px-5 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-xs whitespace-nowrap text-muted-foreground"><strong className="font-mono text-foreground">{totalItems}</strong> liên hệ</p>
          {isSample && <span className="rounded-full border border-status-received/20 bg-status-received-bg px-2.5 py-1 font-condensed text-[9px] font-semibold tracking-wider text-status-received uppercase">Dữ liệu mẫu</span>}
          {refreshing && <LoaderCircle className="size-3 animate-spin text-muted-foreground" aria-label="Đang đồng bộ dữ liệu" />}
        </div>
        {onSearchChange ? (
          <div className="relative mx-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Tìm tên, SĐT, Fanpage, tư vấn viên…"
              className="h-9 rounded-lg bg-background pr-3 pl-8 text-sm"
            />
          </div>
        ) : (
          <span />
        )}
        <div className="shrink-0 justify-self-end">
          {pagination && (
            <PaginationBar
              compact
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              onPageChange={pagination.onPageChange}
            />
          )}
        </div>
      </div>
      <Table className="sm:min-w-[720px]">
        <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
          <TableRow className="hover:bg-transparent">
            <SortableHead
              className="px-5"
              label="Khách hàng"
              active={sort.key === "customer"}
              direction={sort.key === "customer" ? sort.direction : undefined}
              onClick={() => onSortChange(sort.key === "customer" ? { key: "createdAt", direction: "desc" } : { key: "customer", direction: "asc" })}
            />
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nguồn / Fanpage</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Tư vấn viên</TableHead>
            <SortableHead
              className="hidden px-4 xl:table-cell"
              label="Ngày tạo"
              active={sort.key === "createdAt"}
              direction={sort.key === "createdAt" ? sort.direction : undefined}
              onClick={() => onSortChange({ key: "createdAt", direction: sort.key === "createdAt" && sort.direction === "desc" ? "asc" : "desc" })}
            />
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
            <TableHead className="w-10"><span className="sr-only">Mở</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                Không có liên hệ phù hợp. Bạn có thể sửa từ khóa hoặc xóa bộ lọc.
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => {
            return (
              <LeadRow
                key={item.interactionId}
                item={item}
                onOpen={onOpen}
                isSample={isSample}
                currentUserEmail={currentUserEmail}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHead({ label, active, direction, onClick, className }: {
  label: string;
  active: boolean;
  direction?: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {label}
        <Icon className="size-3" aria-hidden="true" />
      </button>
    </TableHead>
  );
}
