"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase, MessageCircleMore } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadDetailSheet } from "@/app/(app)/leads/lead-detail-sheet";
import type { InteractionListItem } from "@/app/(app)/leads/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WorkspaceTable({ items, onOpen }: { items: InteractionListItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <Table className="sm:min-w-[680px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nguồn / Fanpage</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Ngày tạo</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.interactionId} className="group cursor-pointer odd:bg-secondary/10 hover:bg-status-received-bg/45" onClick={() => onOpen(item.interactionId)}>
                <TableCell className="min-w-56 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received transition-colors group-hover:bg-status-received group-hover:text-white">
                      <MessageCircleMore className="size-3.5" />
                    </span>
                    <span className="min-w-0 max-w-48 flex-1 truncate font-medium text-foreground" title={item.customerName}>{item.customerName}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-56 px-4 text-muted-foreground sm:table-cell">
                  <p className="truncate font-medium text-foreground/80" title={item.fanpageName}>{item.fanpageName}</p>
                  <p className="mt-0.5 truncate text-xs" title={item.sourceName}>{item.sourceName}</p>
                </TableCell>
                <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">{formatDate(item.createdLeadAt)}</TableCell>
                <TableCell className="px-4"><StatusPill status={item.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function WorkspaceView({ initialWorkspace }: { initialWorkspace: InteractionListItem[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Briefcase className="size-4 text-status-received" />
        <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Workspace của tôi</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{initialWorkspace.length}</span>
      </div>
      {initialWorkspace.length === 0 ? (
        <EmptyState icon={Briefcase} title="Workspace đang trống" description="Liên hệ sẽ tự xuất hiện khi bạn là Tư vấn viên phụ trách." />
      ) : (
        <WorkspaceTable items={initialWorkspace} onOpen={setSelectedId} />
      )}

      <LeadDetailSheet interactionId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} onChanged={() => router.refresh()} />
    </div>
  );
}
