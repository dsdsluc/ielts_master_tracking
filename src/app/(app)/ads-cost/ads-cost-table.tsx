"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, SearchX, LoaderCircle, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FormMessage } from "@/components/form-message";
import { PaginationBar } from "@/components/pagination-bar";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiErrorMessage } from "@/lib/api-client";
import { AdsCostDialog, type AdsCostRow } from "@/app/(app)/ads-cost/ads-cost-dialog";
import { DeleteAdsCostDialog } from "@/app/(app)/ads-cost/delete-ads-cost-dialog";
import { formatDate, formatVnd } from "@/app/(app)/ads-cost/format";

const PAGE_SIZE = 15;

export function AdsCostTable({
  rows,
  branchNames,
  sourceOptions,
  fanpageOptions,
  branchOptions,
  hasFilters = false,
  cleanupEnabled = false,
}: {
  rows: AdsCostRow[];
  branchNames: Record<string, string>;
  sourceOptions: string[];
  fanpageOptions: string[];
  branchOptions: { code: string; name: string }[];
  hasFilters?: boolean;
  cleanupEnabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedIds = pagedRows.map((r) => r.id);
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.has(id));

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Chọn tất cả" chỉ áp dụng cho các dòng đang hiển thị (trang hiện tại).
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        for (const id of pagedIds) next.delete(id);
      } else {
        for (const id of pagedIds) next.add(id);
      }
      return next;
    });
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const data = await apiFetch<{ deletedCount: number }>("/api/ads-cost/cleanup", {
        method: "POST",
        body: JSON.stringify({ ids: [...selected] }),
      });
      setConfirmOpen(false);
      stopSelecting();
      toast.success(`Đã xoá ${data.deletedCount} bản ghi chi phí quảng cáo.`);
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (rows.length === 0) {
    return hasFilters ? (
      <EmptyState
        icon={SearchX}
        title="Không tìm thấy chi phí phù hợp"
        description="Thử đổi từ khoá tìm kiếm hoặc bộ lọc nguồn/cơ sở."
      />
    ) : (
      <EmptyState
        icon={Megaphone}
        title="Chưa có dữ liệu chi phí"
        description="Thêm chi phí quảng cáo theo kỳ để tính hiệu quả trên Dashboard."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card px-5 py-3">
        {selecting ? (
          <>
            <p className="text-xs text-muted-foreground">
              Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong> dòng (trong trang này)
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={stopSelecting}>
                <X className="size-3.5" />
                Huỷ
              </Button>
              <AlertDialog open={confirmOpen} onOpenChange={(next) => { setConfirmOpen(next); if (!next) setError(null); }}>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={selected.size === 0}
                    />
                  }
                >
                  <Trash2 className="size-3.5" />
                  Xoá đã chọn
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xoá {selected.size} bản ghi chi phí?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Các bản ghi đã chọn sẽ bị xoá vĩnh viễn, không thể khôi phục — hành động này sẽ được ghi lại thành 1 dòng
                      System Log.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {error && <FormMessage kind="error">{error}</FormMessage>}

                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button type="button" variant="outline" className="rounded-full" disabled={pending} />}>
                      Huỷ
                    </AlertDialogClose>
                    <Button
                      type="button"
                      className="rounded-full bg-destructive text-white hover:bg-destructive/90"
                      disabled={pending}
                      onClick={handleDelete}
                    >
                      {pending && <LoaderCircle className="animate-spin" />}
                      Xoá {selected.size} dòng
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{rows.length}</strong> bản ghi
            </p>
            <div className="flex items-center gap-2">
              <PaginationBar compact page={page} totalPages={totalPages} totalItems={rows.length} onPageChange={setPage} />
              {cleanupEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setSelecting(true)}
                >
                  <Trash2 className="size-3.5" />
                  Dọn dẹp
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[880px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              {selecting && (
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={allPagedSelected} onCheckedChange={toggleAllOnPage} aria-label="Chọn tất cả đang hiển thị" />
                </TableHead>
              )}
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Kỳ báo cáo</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên quảng cáo</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Fanpage</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở</TableHead>
              <TableHead className="px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí (VND)</TableHead>
              <TableHead className="w-20 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => {
              const checked = selected.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  className={`odd:bg-secondary/10 ${selecting ? "cursor-pointer" : ""} ${checked ? "bg-accent/30" : ""}`}
                  onClick={selecting ? () => toggleOne(row.id) : undefined}
                >
                  {selecting && (
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(row.id)} aria-label="Chọn dòng này" />
                    </TableCell>
                  )}
                  <TableCell className="min-w-36 px-5 py-3.5 text-sm text-muted-foreground">
                    {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
                  </TableCell>
                  <TableCell className="px-4 font-mono text-xs text-foreground">{row.adId}</TableCell>
                  <TableCell className="min-w-40 px-4 text-sm text-foreground">
                    <p className="max-w-56 truncate">{row.adName}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{row.sourceName ?? "—"}</TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground lg:table-cell">
                    <p className="max-w-40 truncate">{row.fanpageName ?? "—"}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                    {row.branchCode ? (branchNames[row.branchCode] ?? row.branchCode) : "—"}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-sm text-foreground">{formatVnd(row.costVnd)}</TableCell>
                  <TableCell className="pr-4 pl-1">
                    {!selecting && (
                      <div className="flex items-center justify-end gap-0.5">
                        <AdsCostDialog
                          mode="edit"
                          row={row}
                          sourceOptions={sourceOptions}
                          fanpageOptions={fanpageOptions}
                          branchOptions={branchOptions}
                        />
                        <DeleteAdsCostDialog id={row.id} adId={row.adId} />
                      </div>
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
