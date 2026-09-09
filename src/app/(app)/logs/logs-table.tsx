"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, LoaderCircle, Trash2, X } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { actionLabel, buildDetailDiffRows, fieldLabel, formatDetailValue, resultLabel } from "@/app/(app)/logs/format";

export type LogRow = {
  logId: string;
  loggedAt: string;
  actorName: string;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  result: string;
  interactionId: string | null;
  customerName: string | null;
  detailOld: unknown;
  detailNew: unknown;
  technicalInfo: string | null;
};

const RESULT_STYLES: Record<string, string> = {
  SUCCESS: "bg-status-qualified-bg text-status-qualified",
  FAIL: "bg-destructive/10 text-destructive",
};

function ResultPill({ result }: { result: string }) {
  const style = RESULT_STYLES[result] ?? "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {resultLabel(result)}
    </span>
  );
}

function hasDetail(row: LogRow) {
  return row.detailOld != null || row.detailNew != null || !!row.technicalInfo;
}

export function LogsTable({ rows, totalItems }: { rows: LogRow[]; totalItems: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageIds = rows.map((r) => r.logId);
  const allPagedSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Chọn tất cả" chỉ áp dụng cho các dòng đang hiển thị (trang hiện tại) —
  // không chọn xuyên trang, tránh xoá nhầm những dòng Admin chưa xem qua.
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/logs/cleanup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logIds: [...selected] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      setConfirmOpen(false);
      stopSelecting();
      toast.success(`Đã xoá ${body.deletedCount} dòng nhật ký.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được.");
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
                    <AlertDialogTitle>Xoá {selected.size} dòng nhật ký?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Các dòng đã chọn sẽ bị xoá vĩnh viễn, không thể khôi phục. Chỉ nên xoá những dòng bạn đã xem qua và không thấy gì bất
                      thường — hành động này sẽ được ghi lại thành 1 dòng log mới.
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
              <strong className="font-mono text-foreground">{totalItems}</strong> dòng nhật ký
            </p>
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
          </>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[920px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              {selecting ? (
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={allPagedSelected} onCheckedChange={toggleAllOnPage} aria-label="Chọn tất cả đang hiển thị" />
                </TableHead>
              ) : (
                <TableHead className="w-8 pl-5" />
              )}
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Thời gian</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Người thực hiện</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Vai trò</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hành động</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Liên hệ liên quan</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Kết quả</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const expandable = !selecting && hasDetail(row);
              const expanded = expandedId === row.logId;
              const checked = selected.has(row.logId);
              const diffRows = expandable ? buildDetailDiffRows(row.detailOld, row.detailNew) : null;
              return (
                <Fragment key={row.logId}>
                  <TableRow
                    className={`odd:bg-secondary/10 ${expandable || selecting ? "cursor-pointer" : ""} ${checked ? "bg-accent/30" : ""}`}
                    onClick={
                      selecting
                        ? () => toggleOne(row.logId)
                        : expandable
                          ? () => setExpandedId(expanded ? null : row.logId)
                          : undefined
                    }
                  >
                    <TableCell className="pl-5" onClick={selecting ? (e) => e.stopPropagation() : undefined}>
                      {selecting ? (
                        <Checkbox checked={checked} onCheckedChange={() => toggleOne(row.logId)} aria-label="Chọn dòng này" />
                      ) : (
                        expandable && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-muted-foreground"
                            aria-label={expanded ? "Thu gọn chi tiết" : "Xem chi tiết"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(expanded ? null : row.logId);
                            }}
                          >
                            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </Button>
                        )
                      )}
                    </TableCell>
                    <TableCell className="min-w-36 px-4 text-sm text-muted-foreground">{formatDateTime(row.loggedAt)}</TableCell>
                    <TableCell className="min-w-40 px-4">
                      <p className="truncate font-medium text-foreground">{row.actorName}</p>
                      {row.actorEmail && <p className="truncate text-xs text-muted-foreground">{row.actorEmail}</p>}
                    </TableCell>
                    <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{row.actorRole}</TableCell>
                    <TableCell className="px-4 text-sm text-foreground">{actionLabel(row.action)}</TableCell>
                    <TableCell className="hidden px-4 text-sm md:table-cell">
                      {row.interactionId ? (
                        <Link
                          href={`/leads/${row.interactionId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-status-received underline underline-offset-2 hover:text-status-received/80"
                        >
                          {row.customerName ?? row.interactionId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      <ResultPill result={row.result} />
                    </TableCell>
                  </TableRow>
                  {expandable && expanded && (
                    <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                      <TableCell />
                      <TableCell colSpan={6} className="px-4 py-4">
                        {diffRows && diffRows.length > 0 && (
                          <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/60 bg-secondary/40">
                                  <th className="px-3 py-1.5 text-left font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trường</th>
                                  <th className="px-3 py-1.5 text-left font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trước</th>
                                  <th className="px-3 py-1.5 text-left font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sau</th>
                                </tr>
                              </thead>
                              <tbody>
                                {diffRows.map((d) => (
                                  <tr key={d.key} className="border-b border-border/40 last:border-0">
                                    <td className="px-3 py-1.5 text-muted-foreground">{fieldLabel(d.key)}</td>
                                    <td className={`px-3 py-1.5 ${d.hasBefore ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-muted-foreground/50"}`}>
                                      {d.hasBefore ? formatDetailValue(d.before) : "—"}
                                    </td>
                                    <td className={`px-3 py-1.5 ${d.hasAfter ? "font-medium text-foreground" : "text-muted-foreground/50"}`}>
                                      {d.hasAfter ? formatDetailValue(d.after) : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {row.technicalInfo && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Ghi chú kỹ thuật: </span>
                            {row.technicalInfo}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
