"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { useToast } from "@/hooks/use-toast";
import { restoreSpam, deleteSpam } from "@/app/(app)/admin/spam-review/spam-review-api";
import { RestoreSpamDialog } from "@/app/(app)/admin/spam-review/restore-spam-dialog";
import { DeleteSpamDialog } from "@/app/(app)/admin/spam-review/delete-spam-dialog";

export type SpamCandidate = {
  interactionId: string;
  customerName: string;
  sourceName: string;
  fanpageName: string;
  assignedBranchCode: string;
  closedByName: string | null;
  closedAt: string | null;
  spamReasonLabel: string;
  conversationLink: string | null;
  rawLink: string;
};

const MAX_SELECTION = 50;
const PAGE_SIZE = 15;

export function SpamReviewView({
  candidates,
  branchNames,
}: {
  candidates: SpamCandidate[];
  branchNames: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const pagedItems = candidates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedIds = useMemo(() => pagedItems.map((c) => c.interactionId), [pagedItems]);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTION) {
          toast.info(`Chỉ chọn tối đa ${MAX_SELECTION} liên hệ mỗi lần xử lý.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        for (const id of pagedIds) next.delete(id);
        return next;
      }
      for (const id of pagedIds) {
        if (next.size >= MAX_SELECTION) {
          toast.info(`Chỉ chọn tối đa ${MAX_SELECTION} liên hệ mỗi lần xử lý.`);
          break;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function handleRestore(note: string) {
    const { restored, skipped } = await restoreSpam([...selected], note || undefined);
    toast.success(
      skipped > 0
        ? `Đã khôi phục ${restored} liên hệ — bỏ qua ${skipped} (không còn ở trạng thái Spam).`
        : `Đã khôi phục ${restored} liên hệ về Tiếp nhận — Leader sẽ phân bổ Sale phụ trách.`
    );
    setSelected(new Set());
    router.refresh();
  }

  async function handleDelete(reason: string) {
    const { deleted, skipped } = await deleteSpam([...selected], reason || undefined);
    toast.success(
      skipped > 0
        ? `Đã xoá ${deleted} liên hệ — bỏ qua ${skipped} (không còn ở trạng thái Spam).`
        : `Đã xoá vĩnh viễn ${deleted} liên hệ Spam.`
    );
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
          <p className="text-xs text-muted-foreground">
            <strong className="font-mono text-foreground">{candidates.length}</strong> liên hệ Spam ·{" "}
            <strong className="font-mono text-foreground">{selected.size}</strong>/{MAX_SELECTION} đã chọn
          </p>
          <PaginationBar compact page={page} totalPages={totalPages} totalItems={candidates.length} onPageChange={setPage} />
        </div>
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-5">
                <Checkbox checked={allPagedSelected} onCheckedChange={toggleAllOnPage} aria-label="Chọn tất cả đang hiển thị" />
              </TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn / Fanpage</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Lý do Spam</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Đóng lúc</TableHead>
              <TableHead className="w-16 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((item) => {
              const checked = selected.has(item.interactionId);
              return (
                <TableRow
                  key={item.interactionId}
                  className={`cursor-pointer odd:bg-secondary/10 ${checked ? "bg-accent/30" : ""}`}
                  onClick={() => toggleOne(item.interactionId)}
                >
                  <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleOne(item.interactionId)} aria-label={`Chọn ${item.customerName}`} />
                  </TableCell>
                  <TableCell className="min-w-40 px-4 py-3.5">
                    <p className="max-w-56 truncate font-medium text-foreground" title={item.customerName}>
                      {item.customerName}
                    </p>
                    {item.closedByName && <p className="truncate text-xs text-muted-foreground">Đóng bởi {item.closedByName}</p>}
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                    {item.sourceName} · {item.fanpageName}
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{branchNames[item.assignedBranchCode] ?? item.assignedBranchCode}</TableCell>
                  <TableCell className="hidden max-w-52 px-4 text-sm text-foreground sm:table-cell">{item.spamReasonLabel}</TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">
                    {item.closedAt ? formatDateTime(item.closedAt) : "—"}
                  </TableCell>
                  <TableCell className="pr-5 pl-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {(item.conversationLink || item.rawLink) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground hover:text-foreground"
                          aria-label="Mở hội thoại"
                          nativeButton={false}
                          render={<a href={item.conversationLink || item.rawLink} target="_blank" rel="noopener noreferrer" />}
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground hover:text-foreground"
                        aria-label="Xem chi tiết"
                        nativeButton={false}
                        render={<Link href={`/admin/monitoring/spam-review/${item.interactionId}`} />}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="shadow-bubble sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur-md">
        <p className="text-xs text-muted-foreground">
          Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong> liên hệ Spam.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-full border-border px-5"
            disabled={selected.size === 0}
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw className="size-4" />
            Khôi phục về Chăm sóc lại ({selected.size})
          </Button>
          <Button
            type="button"
            className="h-11 shrink-0 rounded-full bg-destructive px-5 text-white hover:bg-destructive/90"
            disabled={selected.size === 0}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Xoá vĩnh viễn ({selected.size})
          </Button>
        </div>
      </div>

      <RestoreSpamDialog open={restoreOpen} onOpenChange={setRestoreOpen} selectedCount={selected.size} onConfirm={handleRestore} />
      <DeleteSpamDialog open={deleteOpen} onOpenChange={setDeleteOpen} selectedCount={selected.size} onConfirm={handleDelete} />
    </div>
  );
}
