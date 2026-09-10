"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleOff, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/status-pill";
import { PaginationBar } from "@/components/pagination-bar";
import { FormMessage } from "@/components/form-message";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { updateStatus } from "@/app/(app)/leads/leads-api";
import { SPAM_REASON_OPTIONS } from "@/app/(app)/leads/types";
import { STATUS, SPAM_REASON } from "@/lib/interactions/constants";
import { useToast } from "@/hooks/use-toast";

export type FollowupCandidate = {
  interactionId: string;
  version: number;
  customerName: string;
  status: string;
  sourceName: string;
  fanpageName: string;
  assignedBranchCode: string;
  assignedSaleName: string | null;
  createdLeadAt: string;
  lastActivityAt: string;
  conversationLink: string | null;
  rawLink: string;
};

// "Khách im lặng" cần đối chiếu số lần chăm sóc của Sale (recordTouch) — không
// áp dụng khi Marketing tự đọc hội thoại và đóng Spam ngay tại đây.
const MARKETING_SPAM_REASONS = SPAM_REASON_OPTIONS.filter((r) => r.code !== SPAM_REASON.NO_REPLY);

const MAX_SELECTION = 50;
const PAGE_SIZE = 15;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function FollowupView({
  candidates,
  branchNames,
}: {
  candidates: FollowupCandidate[];
  branchNames: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spamTarget, setSpamTarget] = useState<FollowupCandidate | null>(null);
  const [spamReason, setSpamReason] = useState("");
  const [spamPending, setSpamPending] = useState(false);
  const [spamError, setSpamError] = useState<string | null>(null);

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
          toast.info(`Chỉ chọn tối đa ${MAX_SELECTION} liên hệ mỗi lần gửi.`);
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
          toast.info(`Chỉ chọn tối đa ${MAX_SELECTION} liên hệ mỗi lần gửi.`);
          break;
        }
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/interactions/followup/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionIds: [...selected], suggestion: suggestion.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      const { pushed, skipped } = body as { pushed: number; skipped: number };
      toast.success(skipped > 0 ? `Đã gửi ${pushed} liên hệ — bỏ qua ${skipped} (đã đổi trạng thái/đã gắn cờ trước đó).` : `Đã gửi yêu cầu chăm sóc lại cho ${pushed} liên hệ.`);
      setSelected(new Set());
      setSuggestion("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không gửi được yêu cầu.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  function openSpamDialog(item: FollowupCandidate) {
    setSpamTarget(item);
    setSpamReason("");
    setSpamError(null);
  }

  async function handleMarkSpam() {
    if (!spamTarget || !spamReason) return;
    setSpamPending(true);
    setSpamError(null);
    try {
      await updateStatus(spamTarget.interactionId, { status: STATUS.SPAM, expectedVersion: spamTarget.version, spamReason });
      toast.success(`Đã chuyển "${spamTarget.customerName}" sang Spam — không cần chăm sóc lại nữa.`);
      setSpamTarget(null);
      setSpamReason("");
      router.refresh();
    } catch (err) {
      setSpamError(err instanceof Error ? err.message : "Không đóng Spam được.");
    } finally {
      setSpamPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
          <p className="text-xs text-muted-foreground">
            <strong className="font-mono text-foreground">{candidates.length}</strong> liên hệ đủ điều kiện ·{" "}
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
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Tư vấn viên</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Hoạt động gần nhất</TableHead>
              <TableHead className="w-24 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((item) => {
              const checked = selected.has(item.interactionId);
              const idle = daysSince(item.lastActivityAt);
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
                    <p className="truncate font-medium text-foreground">{item.customerName}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                    {item.sourceName} · {item.fanpageName}
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{branchNames[item.assignedBranchCode] ?? item.assignedBranchCode}</TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{item.assignedSaleName ?? "Chưa gán"}</TableCell>
                  <TableCell className="px-4">
                    <StatusPill status={item.status} />
                  </TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">
                    {formatDateTime(item.lastActivityAt)} {idle > 0 && `(${idle} ngày trước)`}
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
                        className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Đánh dấu Spam"
                        onClick={() => openSpamDialog(item)}
                      >
                        <CircleOff className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="shadow-bubble sticky bottom-3 z-30 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur-md sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Gợi ý gửi kèm cho Sale (tuỳ chọn)…"
            className="h-16 resize-none rounded-xl"
          />
          {error && <FormMessage kind="error">{error}</FormMessage>}
        </div>
        <Button
          type="button"
          className="glossy shadow-bubble h-11 shrink-0 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
          disabled={selected.size === 0 || pending}
          onClick={handleSubmit}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Sparkles className="size-4" />}
          Gửi yêu cầu chăm sóc lại ({selected.size})
        </Button>
      </div>

      <AlertDialog
        open={!!spamTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSpamTarget(null);
            setSpamError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đánh dấu Spam?</AlertDialogTitle>
            <AlertDialogDescription>
              Liên hệ <strong className="text-foreground">{spamTarget?.customerName}</strong> sẽ chuyển thẳng sang Spam — dùng khi đọc hội
              thoại thấy rõ khách không có nhu cầu, khỏi cần gửi yêu cầu chăm sóc lại cho Sale nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Lý do</Label>
            <Select value={spamReason} onValueChange={(v) => setSpamReason(v ?? "")}>
              <SelectTrigger className="h-10 w-full rounded-xl bg-background">
                <SelectValue placeholder="Chọn lý do" />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_SPAM_REASONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {spamError && <FormMessage kind="error">{spamError}</FormMessage>}

          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" className="rounded-full" disabled={spamPending} />}>
              Huỷ
            </AlertDialogClose>
            <Button
              type="button"
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              disabled={!spamReason || spamPending}
              onClick={handleMarkSpam}
            >
              {spamPending && <LoaderCircle className="animate-spin" />}
              Chuyển Spam
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
