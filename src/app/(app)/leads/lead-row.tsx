"use client";

import { useState } from "react";
import { ChevronRight, LoaderCircle, MessageCircleMore, Plus, Sparkles } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { InteractionListItem } from "@/app/(app)/leads/types";

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
  picking,
  onPick,
}: {
  item: InteractionListItem;
  onOpen: (id: string) => void;
  isSample?: boolean;
  currentUserEmail: string;
  picking: boolean;
  onPick: (item: InteractionListItem) => void;
}) {
  const isMine = item.consultantEmail === currentUserEmail;

  return (
    <TableRow
      onClick={() => !isSample && onOpen(item.interactionId)}
      onKeyDown={(event) => {
        if (!isSample && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(item.interactionId);
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
          <span className="min-w-0 max-w-48 flex-1 truncate font-medium text-foreground">{item.customerName}</span>
          {item.needsFollowup && (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-accent px-2 py-0.5 font-condensed text-[9px] font-semibold tracking-wide text-accent-foreground uppercase">
              <Sparkles className="size-3" /> Cần chăm sóc lại
            </span>
          )}
        </div>
        <p className="mt-1 truncate pl-10 text-xs text-muted-foreground sm:hidden">
          {item.fanpageName} · {formatDate(item.createdLeadAt)}
        </p>
      </TableCell>
      <TableCell className="hidden max-w-56 px-4 text-muted-foreground sm:table-cell">
        <p className="truncate font-medium text-foreground/80">{item.fanpageName}</p>
        <p className="mt-0.5 truncate text-xs">{item.sourceName}</p>
      </TableCell>
      <TableCell className="hidden px-4 text-muted-foreground lg:table-cell" onClick={(e) => e.stopPropagation()}>
        {item.consultantName ? (
          <p className={isMine ? "max-w-32 truncate font-medium text-status-received" : "max-w-32 truncate"}>
            {isMine ? "Bạn" : item.consultantName}
          </p>
        ) : isSample ? (
          <span className="text-muted-foreground">Chưa gán</span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full border-status-received/30 px-2.5 text-xs text-status-received hover:bg-status-received-bg hover:text-status-received"
            onClick={() => onPick(item)}
            disabled={picking}
          >
            {picking ? <LoaderCircle className="size-3 animate-spin" /> : <Plus className="size-3" />}
            Nhận
          </Button>
        )}
      </TableCell>
      <TableCell className="hidden px-4 font-mono text-xs text-muted-foreground md:table-cell">
        {item.touchCount} lần
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
  onOpen,
  isSample = false,
  currentUserEmail,
  currentUserName,
}: {
  items: InteractionListItem[];
  onOpen: (id: string) => void;
  isSample?: boolean;
  currentUserEmail: string;
  currentUserName: string;
}) {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, { email: string; name: string }>>({});
  const [pickingId, setPickingId] = useState<string | null>(null);

  async function handlePick(item: InteractionListItem) {
    setPickingId(item.interactionId);
    try {
      const res = await fetch("/api/workspace/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionIds: [item.interactionId] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      if (body.conflicts?.length > 0) {
        toast.error(`${item.customerName} vừa được Sale khác nhận vào Workspace của họ trước.`);
      } else {
        setOverrides((prev) => ({ ...prev, [item.interactionId]: { email: currentUserEmail, name: currentUserName } }));
        toast.success(`Đã nhận ${item.customerName} vào Workspace của bạn.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không nhận được liên hệ này.");
    } finally {
      setPickingId(null);
    }
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground"><strong className="font-mono text-foreground">{items.length}</strong> liên hệ hiển thị</p>
        {isSample && <span className="rounded-full border border-status-received/20 bg-status-received-bg px-2.5 py-1 font-condensed text-[9px] font-semibold tracking-wider text-status-received uppercase">Dữ liệu mẫu</span>}
      </div>
      <Table className="sm:min-w-[720px]">
        <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nguồn / Fanpage</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Tư vấn viên</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Chăm sóc</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Ngày tạo</TableHead>
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
            <TableHead className="w-10"><span className="sr-only">Mở</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const override = overrides[item.interactionId];
            const displayItem = override ? { ...item, consultantEmail: override.email, consultantName: override.name } : item;
            return (
              <LeadRow
                key={item.interactionId}
                item={displayItem}
                onOpen={onOpen}
                isSample={isSample}
                currentUserEmail={currentUserEmail}
                picking={pickingId === item.interactionId}
                onPick={handlePick}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
