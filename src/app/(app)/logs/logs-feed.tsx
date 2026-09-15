"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  GraduationCap,
  LoaderCircle,
  MessageCircleMore,
  ScrollText,
  Sparkles,
  TimerOff,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { apiFetch, apiErrorMessage } from "@/lib/api-client";
import {
  actionCategory,
  actionLabel,
  buildDetailDiffRows,
  fieldLabel,
  formatDetailValue,
  LOG_CATEGORY_META,
  resultLabel,
  type LogCategoryKey,
} from "@/app/(app)/logs/format";

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

const CATEGORY_ICON: Record<LogCategoryKey, LucideIcon> = {
  lead: MessageCircleMore,
  followup: Sparkles,
  student: GraduationCap,
  sla: TimerOff,
};

const FALLBACK_META = { label: "Khác", bgClass: "bg-secondary", textClass: "text-muted-foreground" };

function categoryMeta(action: string) {
  const key = actionCategory(action);
  return { key, ...(key ? LOG_CATEGORY_META[key] : FALLBACK_META) };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

// "Hôm nay"/"Hôm qua" cho 2 ngày gần nhất — đọc nhanh hơn ngày tháng khi lướt
// hoạt động hằng ngày; các ngày cũ hơn hiện đủ thứ/ngày/tháng/năm.
function dayLabel(iso: string) {
  const d = new Date(iso);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayOnly.getTime() - dOnly.getTime()) / 86400000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupByDay(rows: LogRow[]): { label: string; rows: LogRow[] }[] {
  const groups: { label: string; rows: LogRow[] }[] = [];
  for (const row of rows) {
    const label = dayLabel(row.loggedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

function hasDetail(row: LogRow) {
  return row.detailOld != null || row.detailNew != null || !!row.technicalInfo;
}

export function LogsFeed({ rows, totalItems }: { rows: LogRow[]; totalItems: number }) {
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
  const groups = groupByDay(rows);

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
      const data = await apiFetch<{ deletedCount: number }>("/api/logs/cleanup", {
        method: "POST",
        body: JSON.stringify({ logIds: [...selected] }),
      });
      setConfirmOpen(false);
      stopSelecting();
      toast.success(`Đã xoá ${data.deletedCount} dòng nhật ký.`);
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
            <div className="flex items-center gap-2.5">
              <Checkbox checked={allPagedSelected} onCheckedChange={toggleAllOnPage} aria-label="Chọn tất cả đang hiển thị" />
              <p className="text-xs text-muted-foreground">
                Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong> dòng (trong trang này)
              </p>
            </div>
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
              <strong className="font-mono text-foreground">{totalItems}</strong> hoạt động
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

      <div className="divide-y divide-border/60">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="sticky top-0 z-10 bg-secondary/80 px-5 py-2 font-condensed text-[10px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur-md">
              {group.label}
            </div>
            <div className="divide-y divide-border/40">
              {group.rows.map((row) => {
                const expandable = !selecting && hasDetail(row);
                const expanded = expandedId === row.logId;
                const checked = selected.has(row.logId);
                const meta = categoryMeta(row.action);
                const Icon = meta.key ? CATEGORY_ICON[meta.key] : ScrollText;
                const diffRows = expandable ? buildDetailDiffRows(row.detailOld, row.detailNew) : null;

                return (
                  <Fragment key={row.logId}>
                    <div
                      className={`flex items-start gap-3 px-5 py-3 transition-colors ${expandable || selecting ? "cursor-pointer hover:bg-secondary/30" : ""} ${checked ? "bg-accent/30" : ""}`}
                      onClick={
                        selecting
                          ? () => toggleOne(row.logId)
                          : expandable
                            ? () => setExpandedId(expanded ? null : row.logId)
                            : undefined
                      }
                    >
                      {selecting ? (
                        <div className="flex size-9 shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleOne(row.logId)} aria-label="Chọn dòng này" />
                        </div>
                      ) : (
                        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${meta.bgClass}`}>
                          <Icon className={`size-4 ${meta.textClass}`} />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="font-medium text-foreground">{row.actorName}</span>
                          <span className="text-sm text-muted-foreground">{actionLabel(row.action).toLowerCase()}</span>
                          {row.interactionId && (
                            <Link
                              href={`/leads/${row.interactionId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-status-received underline underline-offset-2 hover:text-status-received/80"
                            >
                              {row.customerName ?? row.interactionId}
                            </Link>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{row.actorRole}</span>
                          <span aria-hidden>·</span>
                          <span className={meta.textClass}>{meta.label}</span>
                          {row.result === "FAIL" && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              {resultLabel(row.result)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                        {formatTime(row.loggedAt)}
                        {expandable &&
                          (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
                      </div>
                    </div>

                    {expandable && expanded && (
                      <div className="bg-secondary/20 px-5 py-4 pl-[3.25rem]">
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
                            <span className="font-medium text-foreground">Ghi chú: </span>
                            {row.technicalInfo}
                          </p>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
