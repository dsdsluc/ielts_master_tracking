"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListChecks, LoaderCircle, TimerOff, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/pagination-bar";
import { FormMessage } from "@/components/form-message";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import type { InteractionListItem } from "@/lib/interactions/types";

export type SlaReviewRow = InteractionListItem & {
  slaFlagged: boolean;
  slaFlaggedAt: string | null;
  slaFlaggedByName: string | null;
};

const PAGE_SIZE = 20;

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

export function SlaReviewView({
  items,
  unflaggedCount,
  branchNames,
}: {
  items: SlaReviewRow[];
  unflaggedCount: number;
  branchNames: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedSelectableIds = useMemo(
    () => pagedItems.filter((i) => !i.slaFlagged).map((i) => i.interactionId),
    [pagedItems]
  );
  const allPagedSelected = pagedSelectableIds.length > 0 && pagedSelectableIds.every((id) => selected.has(id));

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setError(null);
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Chọn tất cả" chỉ áp dụng cho các dòng chưa đánh dấu, trong phạm vi trang
  // đang hiển thị — giống cơ chế chọn ở System Log/Chi phí quảng cáo.
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        for (const id of pagedSelectableIds) next.delete(id);
      } else {
        for (const id of pagedSelectableIds) next.add(id);
      }
      return next;
    });
  }

  async function handleFlag() {
    if (selected.size === 0) return;
    setPending(true);
    setError(null);
    try {
      const data = await apiFetch<{ flaggedCount: number }>("/api/admin/sla/flag", {
        method: "POST",
        body: JSON.stringify({ interactionIds: [...selected] }),
      });
      toast.success(`Đã đánh dấu ${data.flaggedCount} liên hệ quá SLA.`);
      stopSelecting();
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card px-5 py-3">
        {selecting ? (
          <>
            <p className="text-xs text-muted-foreground">
              Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong> liên hệ
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={stopSelecting}>
                <X className="size-3.5" />
                Huỷ
              </Button>
              <Button
                type="button"
                size="sm"
                className="glossy rounded-full bg-status-waiting px-4 text-white hover:bg-status-waiting/90"
                disabled={selected.size === 0 || pending}
                onClick={handleFlag}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <TimerOff className="size-3.5" />}
                Đánh dấu SLA ({selected.size})
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{items.length}</strong> liên hệ quá hạn ·{" "}
              <strong className="font-mono text-foreground">{unflaggedCount}</strong> chưa đánh dấu
            </p>
            <div className="flex items-center gap-2">
              <PaginationBar compact page={page} totalPages={totalPages} totalItems={items.length} onPageChange={setPage} />
              {unflaggedCount > 0 && (
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelecting(true)}>
                  <ListChecks className="size-3.5" />
                  Chọn
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="px-5 pt-3">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              {selecting && (
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={allPagedSelected} onCheckedChange={toggleAllOnPage} aria-label="Chọn tất cả đang hiển thị" />
                </TableHead>
              )}
              <TableHead className={`font-condensed text-[10px] tracking-wider text-muted-foreground uppercase ${selecting ? "px-4" : "px-5"}`}>Khách hàng</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn / Fanpage</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã tạo</TableHead>
              <TableHead className="px-4 pr-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đánh dấu SLA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((item) => {
              const checked = selected.has(item.interactionId);
              const selectable = !item.slaFlagged;
              return (
                <TableRow
                  key={item.interactionId}
                  className={`odd:bg-secondary/10 ${selecting && selectable ? "cursor-pointer" : ""} ${checked ? "bg-accent/30" : ""}`}
                  onClick={() => selecting && selectable && toggleOne(item.interactionId)}
                >
                  {selecting && (
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      {selectable && (
                        <Checkbox checked={checked} onCheckedChange={() => toggleOne(item.interactionId)} aria-label={`Chọn ${item.customerName}`} />
                      )}
                    </TableCell>
                  )}
                  <TableCell className={`py-3.5 ${selecting ? "px-4" : "px-5"}`}>
                    <p className="max-w-48 truncate font-medium text-foreground">{item.customerName}</p>
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">
                    {branchNames[item.assignedBranchCode] ?? item.assignedBranchCode}
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                    <p className="max-w-48 truncate">{item.fanpageName}</p>
                    <p className="text-xs">{item.sourceName}</p>
                  </TableCell>
                  <TableCell className="px-4 text-xs text-muted-foreground">
                    {formatDateTime(item.createdLeadAt)}
                    <br />
                    {hoursSince(item.createdLeadAt)} giờ trước
                  </TableCell>
                  <TableCell className="px-4 pr-5 text-xs">
                    {item.slaFlagged ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-qualified-bg px-2.5 py-0.5 text-status-qualified">
                        <CheckCircle2 className="size-3.5" />
                        {item.slaFlaggedByName ?? "Đã đánh dấu"}
                        {item.slaFlaggedAt && <span className="block text-[11px]">{formatDateTime(item.slaFlaggedAt)}</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Chưa đánh dấu</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
