"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, LoaderCircle, MessageCircleMore, Unlock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiErrorMessage } from "@/lib/api-client";
import { LeadDetailSheet } from "@/app/(app)/leads/lead-detail-sheet";
import type { InteractionListItem } from "@/app/(app)/leads/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WorkspaceTable({
  items,
  onOpen,
  actionIcon,
  actionLabel,
  actionClassName,
  onAction,
  pendingIds,
}: {
  items: InteractionListItem[];
  onOpen: (id: string) => void;
  actionIcon: ReactNode;
  actionLabel: string;
  actionClassName: string;
  onAction: (item: InteractionListItem) => void;
  pendingIds?: Set<string>;
}) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <Table className="sm:min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nguồn / Fanpage</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Chăm sóc</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Ngày tạo</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
              <TableHead className="w-36 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.interactionId}
                className={cn("group cursor-pointer odd:bg-secondary/10 hover:bg-status-received-bg/45")}
                onClick={() => onOpen(item.interactionId)}
              >
                <TableCell className="min-w-56 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received transition-colors group-hover:bg-status-received group-hover:text-white">
                      <MessageCircleMore className="size-3.5" />
                    </span>
                    <span className="min-w-0 max-w-48 flex-1 truncate font-medium text-foreground">{item.customerName}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden max-w-56 px-4 text-muted-foreground sm:table-cell">
                  <p className="truncate font-medium text-foreground/80">{item.fanpageName}</p>
                  <p className="mt-0.5 truncate text-xs">{item.sourceName}</p>
                </TableCell>
                <TableCell className="hidden px-4 font-mono text-xs text-muted-foreground md:table-cell">{item.touchCount} lần</TableCell>
                <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">{formatDate(item.createdLeadAt)}</TableCell>
                <TableCell className="px-4">
                  <StatusPill status={item.status} />
                </TableCell>
                <TableCell className="pr-4 pl-1 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={actionClassName}
                    disabled={pendingIds?.has(item.interactionId)}
                    onClick={() => onAction(item)}
                  >
                    {pendingIds?.has(item.interactionId) ? <LoaderCircle className="size-3.5 animate-spin" /> : actionIcon}
                    {actionLabel}
                  </Button>
                </TableCell>
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
  const { toast } = useToast();
  const [releasedIds, setReleasedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const workspace = useMemo(
    () => initialWorkspace.filter((item) => !releasedIds.has(item.interactionId)),
    [initialWorkspace, releasedIds],
  );

  function markPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function releaseFromWorkspace(item: InteractionListItem) {
    markPending(item.interactionId, true);
    try {
      await apiFetch("/api/workspace/release", {
        method: "POST",
        body: JSON.stringify({ interactionId: item.interactionId }),
      });
      setReleasedIds((prev) => new Set(prev).add(item.interactionId));
      toast.success(`Đã giải phóng ${item.customerName} khỏi Workspace của bạn.`);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      markPending(item.interactionId, false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Briefcase className="size-4 text-status-received" />
        <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Workspace của tôi</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{workspace.length}</span>
      </div>
      {workspace.length === 0 ? (
        <EmptyState icon={Briefcase} title="Workspace đang trống" description="Chọn liên hệ ở hàng đợi tại trang Liên hệ để thêm vào đây." />
      ) : (
        <WorkspaceTable
          items={workspace}
          onOpen={setSelectedId}
          actionIcon={<Unlock className="size-3.5" />}
          actionLabel="Giải phóng"
          actionClassName="h-9 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onAction={releaseFromWorkspace}
          pendingIds={pendingIds}
        />
      )}

      <LeadDetailSheet interactionId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} onChanged={() => router.refresh()} />
    </div>
  );
}
