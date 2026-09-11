"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GitMerge, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { STATUS } from "@/lib/interactions/constants";
import { cn } from "@/lib/utils";

export type DuplicateCandidate = {
  customerKey: string;
  displayName: string;
  canonicalLink: string;
  phoneNormalized: string | null;
  currentStatusName: string;
  firstTouchAt: string;
  lastTouchAt: string;
  interactions: {
    interactionId: string;
    rawLink: string;
    sourceName: string;
    fanpageName: string;
    adId: string | null;
    statusName: string;
    branchName: string;
    createdByName: string | null;
    createdLeadAt: string;
  }[];
};

const STATUS_OPTIONS = [STATUS.WAITING, STATUS.PROCESSING, STATUS.PHONE, STATUS.SPAM];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function DuplicateMergeView({
  phone,
  candidates,
  backLink,
}: {
  phone: string;
  candidates: DuplicateCandidate[];
  backLink: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  // Mặc định chọn bản ghi có nhiều lượt tương tác nhất làm bản ghi chính.
  const defaultPrimary = useMemo(
    () => [...candidates].sort((a, b) => b.interactions.length - a.interactions.length)[0]?.customerKey,
    [candidates]
  );
  const [primaryKey, setPrimaryKey] = useState(defaultPrimary);
  const primary = candidates.find((c) => c.customerKey === primaryKey) ?? candidates[0];
  const others = candidates.filter((c) => c.customerKey !== primary.customerKey);

  const [mergedName, setMergedName] = useState(primary.displayName);
  const [mergedPhone, setMergedPhone] = useState(primary.phoneNormalized ?? phone);
  const [mergedLink, setMergedLink] = useState(primary.canonicalLink);
  const [mergedStatus, setMergedStatus] = useState(primary.currentStatusName);
  const [merging, setMerging] = useState(false);

  function selectPrimary(key: string) {
    setPrimaryKey(key);
    const c = candidates.find((x) => x.customerKey === key);
    if (c) {
      setMergedName(c.displayName);
      setMergedPhone(c.phoneNormalized ?? phone);
      setMergedLink(c.canonicalLink);
      setMergedStatus(c.currentStatusName);
    }
  }

  const totalInteractions = candidates.reduce((sum, c) => sum + c.interactions.length, 0);

  async function handleMerge() {
    setMerging(true);
    try {
      await apiFetch("/api/customers/merge", {
        method: "POST",
        body: JSON.stringify({
          keepCustomerKey: primary.customerKey,
          removeCustomerKeys: others.map((c) => c.customerKey),
          displayName: mergedName,
          phoneNormalized: mergedPhone || undefined,
          canonicalLink: mergedLink,
          currentStatusName: mergedStatus,
        }),
      });
      toast.success(`Đã gộp ${others.length} bản ghi vào "${mergedName}".`);
      router.push("/customers/duplicates");
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setMerging(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        {backLink}
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Khách hàng trùng</span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">SĐT {phone}</h1>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Xem đầy đủ thông tin từng bản ghi bên dưới rồi chọn 1 bản ghi làm chính — tổng{" "}
        <strong className="font-mono text-foreground">{totalInteractions}</strong> lượt liên hệ của các bản ghi còn lại sẽ được gộp vào, rồi
        các bản ghi đó bị xoá.
      </p>

      <div className={cn("mb-6 grid gap-4", candidates.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
        {candidates.map((c) => {
          const isPrimary = c.customerKey === primary.customerKey;
          return (
            <div
              key={c.customerKey}
              className={cn(
                "shadow-bubble flex flex-col gap-3 rounded-2xl border-2 bg-card p-4 transition-colors",
                isPrimary ? "border-primary" : "border-transparent ring-1 ring-border/70"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.displayName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{c.customerKey}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={isPrimary ? "default" : "outline"}
                  className={cn("shrink-0 rounded-full", isPrimary && "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => selectPrimary(c.customerKey)}
                >
                  {isPrimary && <CheckCircle2 className="size-3.5" />}
                  {isPrimary ? "Bản ghi chính" : "Chọn làm chính"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-secondary/40 p-3 text-xs">
                <span className="text-muted-foreground">SĐT</span>
                <span className="text-right font-mono text-foreground">{c.phoneNormalized ?? "—"}</span>
                <span className="text-muted-foreground">Link chuẩn</span>
                <span className="truncate text-right text-foreground" title={c.canonicalLink}>
                  {c.canonicalLink}
                </span>
                <span className="text-muted-foreground">Trạng thái</span>
                <span className="text-right">
                  <StatusPill status={c.currentStatusName} />
                </span>
                <span className="text-muted-foreground">Lần chạm đầu</span>
                <span className="text-right text-foreground">{formatDate(c.firstTouchAt)}</span>
                <span className="text-muted-foreground">Lần chạm cuối</span>
                <span className="text-right text-foreground">{formatDate(c.lastTouchAt)}</span>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 pt-2.5">
                <p className="font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                  Lịch sử liên hệ ({c.interactions.length})
                </p>
                {c.interactions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Chưa có liên hệ nào.</p>
                ) : (
                  <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                    {c.interactions.map((i) => (
                      <div key={i.interactionId} className="rounded-lg border border-border/60 p-2.5 text-xs">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {i.sourceName} · {i.fanpageName}
                          </span>
                          <StatusPill status={i.statusName} />
                        </div>
                        <p className="truncate text-muted-foreground" title={i.rawLink}>
                          {i.rawLink}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
                          <span>Cơ sở: {i.branchName}</span>
                          {i.adId && <span>Ad ID: {i.adId}</span>}
                          <span>Tạo bởi: {i.createdByName ?? "—"}</span>
                          <span>{formatDateTime(i.createdLeadAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="shadow-bubble rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">
          <GitMerge className="size-3.5" /> Thông tin sau khi gộp — chỉnh sửa nếu cần trước khi lưu
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merged-name">Tên khách hàng</Label>
            <Input id="merged-name" value={mergedName} onChange={(e) => setMergedName(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merged-phone">Số điện thoại</Label>
            <Input id="merged-phone" value={mergedPhone} onChange={(e) => setMergedPhone(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merged-link">Link chuẩn</Label>
            <Input id="merged-link" value={mergedLink} onChange={(e) => setMergedLink(e.target.value)} className="h-10 rounded-xl font-mono text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Trạng thái</Label>
            <Select value={mergedStatus} onValueChange={(v) => setMergedStatus(v ?? mergedStatus)}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            Sẽ xoá <strong className="text-destructive">{others.length}</strong> bản ghi còn lại sau khi chuyển hết lịch sử liên hệ về "
            {mergedName}".
          </p>
          <Button
            type="button"
            className="glossy shadow-bubble rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
            disabled={merging || !mergedName.trim() || !mergedLink.trim()}
            onClick={handleMerge}
          >
            {merging && <LoaderCircle className="animate-spin" />}
            Gộp & xoá bản ghi còn lại
          </Button>
        </div>
      </div>
    </>
  );
}
