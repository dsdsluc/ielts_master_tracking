"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { AssignFollowupDialog } from "@/app/(app)/followup-assign/assign-followup-dialog";

export type FollowupAssignItem = {
  interactionId: string;
  customerName: string;
  status: string;
  branchName: string;
  mktSuggestion: string | null;
  mktPushedAt: string;
  mktPushedByName: string | null;
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function FollowupAssignView({ items }: { items: FollowupAssignItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [singleTarget, setSingleTarget] = useState<FollowupAssignItem | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const visibleItems = useMemo(() => items.filter((i) => !resolvedIds.has(i.interactionId)), [items, resolvedIds]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === visibleItems.length ? new Set() : new Set(visibleItems.map((i) => i.interactionId))));
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function assign(interactionIds: string[], targetSaleEmail: string) {
    const { assigned, skipped } = await apiFetch<{ assigned: number; skipped: number }>("/api/interactions/followup/assign", {
      method: "POST",
      body: JSON.stringify({ interactionIds, targetSaleEmail }),
    });
    toast.success(
      skipped > 0
        ? `Đã phân bổ ${assigned}/${interactionIds.length} liên hệ — bỏ qua ${skipped} (đã được phân bổ trước đó).`
        : `Đã phân bổ ${assigned} liên hệ.`
    );
    setResolvedIds((prev) => {
      const next = new Set(prev);
      interactionIds.forEach((id) => next.add(id));
      return next;
    });
    router.refresh();
  }

  async function handleAssignSingle(targetSaleEmail: string) {
    if (!singleTarget) return;
    await assign([singleTarget.interactionId], targetSaleEmail);
    setSingleTarget(null);
  }

  async function handleAssignBulk(targetSaleEmail: string) {
    await assign([...selected], targetSaleEmail);
    stopSelecting();
  }

  if (visibleItems.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Không có yêu cầu nào chờ phân bổ"
        description="Mọi yêu cầu chăm sóc lại Marketing gửi đến đã được gán cho Sale phụ trách."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{visibleItems.length}</strong> yêu cầu chờ phân bổ
        </p>
        {selecting ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong>
            </p>
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={stopSelecting}>
              <X className="size-3.5" /> Huỷ
            </Button>
            <Button
              type="button"
              size="sm"
              className="glossy rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
              disabled={selected.size === 0}
              onClick={() => setBulkDialogOpen(true)}
            >
              Phân bổ ({selected.size})
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={() => setSelecting(true)}>
            <ListChecks className="size-3.5" />
            Chọn để phân bổ hàng loạt
          </Button>
        )}
      </div>

      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              {selecting && (
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={selected.size === visibleItems.length} onCheckedChange={toggleAll} aria-label="Chọn tất cả" />
                </TableHead>
              )}
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
              <TableHead className="hidden min-w-56 px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Ghi chú từ Marketing</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Người gửi</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Thời gian gửi</TableHead>
              <TableHead className="w-40 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => {
              const checked = selected.has(item.interactionId);
              const idle = daysSince(item.mktPushedAt);
              return (
                <TableRow
                  key={item.interactionId}
                  className={`odd:bg-secondary/10 align-top ${selecting ? "cursor-pointer" : ""} ${checked ? "bg-accent/30" : ""}`}
                  onClick={selecting ? () => toggleOne(item.interactionId) : undefined}
                >
                  {selecting && (
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(item.interactionId)} aria-label={`Chọn ${item.customerName}`} />
                    </TableCell>
                  )}
                  <TableCell className="min-w-40 px-5 py-3.5">
                    <p className="max-w-56 truncate font-medium text-foreground" title={item.customerName}>
                      {item.customerName}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">{item.branchName}</TableCell>
                  <TableCell className="hidden px-4 py-3.5 text-sm text-foreground md:table-cell">
                    <p className="line-clamp-3 max-w-72 whitespace-pre-line">{item.mktSuggestion ?? "—"}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 py-3.5 text-sm text-muted-foreground sm:table-cell">{item.mktPushedByName ?? "—"}</TableCell>
                  <TableCell className="hidden px-4 py-3.5 text-xs text-muted-foreground lg:table-cell">
                    {formatDateTime(item.mktPushedAt)}
                    {idle > 0 && (
                      <>
                        <br />
                        {idle} ngày trước
                      </>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 pr-5 pl-1 text-right" onClick={(e) => e.stopPropagation()}>
                    {!selecting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full border-status-received/30 text-status-received hover:bg-status-received-bg hover:text-status-received"
                        onClick={() => setSingleTarget(item)}
                      >
                        Phân bổ
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AssignFollowupDialog
        open={!!singleTarget}
        onOpenChange={(open) => !open && setSingleTarget(null)}
        selectedCount={1}
        onConfirm={handleAssignSingle}
      />
      <AssignFollowupDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedCount={selected.size}
        onConfirm={handleAssignBulk}
      />
    </div>
  );
}
