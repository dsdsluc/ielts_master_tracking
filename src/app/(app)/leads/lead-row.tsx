import { ChevronRight, MessageCircleMore, Sparkles } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}: {
  item: InteractionListItem;
  onOpen: (id: string) => void;
  isSample?: boolean;
}) {
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
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received transition-colors group-hover:bg-status-received group-hover:text-white">
            <MessageCircleMore className="size-3.5" />
          </span>
          <span className="truncate font-medium text-foreground">{item.customerName}</span>
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
      <TableCell className="hidden px-4 text-muted-foreground lg:table-cell">
        {item.assignedSaleName ?? "Chưa gán"}
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
}: {
  items: InteractionListItem[];
  onOpen: (id: string) => void;
  isSample?: boolean;
}) {
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
        <TableBody>{items.map((item) => <LeadRow key={item.interactionId} item={item} onOpen={onOpen} isSample={isSample} />)}</TableBody>
      </Table>
    </div>
  );
}
