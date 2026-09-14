"use client";

import type { ReactNode } from "react";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { ResolvedPill, type FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export function FollowupResultReviewDialog({
  row,
  branchName,
  onOpenChange,
}: {
  row: FollowupTrackingRow | null;
  branchName: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card/98 p-5 backdrop-blur-xl sm:max-w-lg sm:p-7">
        {row && (
          <>
            <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pr-8">
              <span className="glossy row-span-3 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <History className="size-5 text-gold" />
              </span>
              <p className="font-condensed text-[10px] tracking-[0.2em] text-gold uppercase">Kết quả chăm sóc lại</p>
              <DialogTitle className="text-lg">{row.customerName}</DialogTitle>
              <DialogDescription>Toàn bộ diễn biến yêu cầu chăm sóc lại của liên hệ này.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-2">
              <Field label="Cơ sở" value={branchName} />
              <Field label="Trạng thái hiện tại" value={<StatusPill status={row.status} />} />
              <Field label="Gửi yêu cầu lúc" value={formatDateTime(row.mktPushedAt)} />
              <Field label="Gửi bởi" value={row.mktPushedByName} />
              {row.mktSuggestion && (
                <div className="col-span-2">
                  <Field label="Gợi ý Marketing gửi kèm" value={row.mktSuggestion} />
                </div>
              )}

              <div className="col-span-2 border-t border-border/70 pt-4">
                <Field label="Kết quả xử lý" value={<ResolvedPill pending={row.needsFollowup} outcome={row.followupOutcome} status={row.status} />} />
              </div>
              <Field label="Xử lý bởi" value={row.followupHandledByName} />
              <Field label="Xử lý lúc" value={row.followupHandledAt ? formatDateTime(row.followupHandledAt) : null} />
              <Field label="Số lần đánh dấu xử lý" value={row.followupResolvedCount} />
              <div className="col-span-2">
                <Field label="Ghi chú xử lý" value={<p className="whitespace-pre-wrap">{row.resolveNote ?? "—"}</p>} />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
