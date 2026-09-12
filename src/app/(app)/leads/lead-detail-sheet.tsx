"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ExternalLink,
  History,
  LoaderCircle,
  Maximize2,
  MessageCircleMore,
  PhoneCall,
  Sparkles,
  UserCog,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusPill } from "@/components/status-pill";
import { FormMessage } from "@/components/form-message";
import { useInteractionDetail } from "@/app/(app)/leads/use-interaction-detail";
import { CopyButton } from "@/app/(app)/leads/copy-button";
import { TouchLogDialog } from "@/app/(app)/leads/touch-log-dialog";
import { InfoRow } from "@/app/(app)/leads/info-row";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { QualifyDialog } from "@/app/(app)/leads/qualify-dialog";
import { SpamDialog } from "@/app/(app)/leads/spam-dialog";
import { ReassignDialog } from "@/app/(app)/leads/reassign-dialog";

export function LeadDetailSheet({
  interactionId,
  onOpenChange,
  onChanged,
}: {
  interactionId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const {
    detail,
    loading,
    error,
    touchPending,
    followupPending,
    handleLogTouch,
    handleResolveFollowup,
    handleMoveToInProgress,
    refresh,
  } = useInteractionDetail(interactionId, onChanged);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [spamOpen, setSpamOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const open = interactionId !== null;
  const isOpenStatus = detail?.status === "Chờ" || detail?.status === "Tiếp nhận";
  const canReassign = detail?.permissions.canReassign ?? false;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl">
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && error && !detail && (
            <div className="p-6">
              <FormMessage kind="error">{error}</FormMessage>
            </div>
          )}

          {!loading && detail && (
            <>
              <SheetHeader className="gap-1.5 border-b border-border px-6 py-5 pr-12">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <SheetTitle className="text-lg">{detail.customerName}</SheetTitle>
                  <StatusPill status={detail.status} />
                </div>
                <SheetDescription>
                  {detail.sourceName} · {detail.fanpageName}
                  {detail.adId ? ` · Ad ${detail.adId}` : ""}
                </SheetDescription>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 w-fit rounded-full text-muted-foreground hover:text-foreground"
                  nativeButton={false}
                  render={<Link href={`/leads/${detail.interactionId}`} />}
                >
                  <Maximize2 className="size-3.5" />
                  Mở trang chi tiết
                </Button>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {detail.needsFollowup && (
                  <div className="mb-5 flex flex-col gap-2 rounded-xl border border-accent bg-accent/40 p-4">
                    <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                      <Sparkles className="size-3.5" /> Marketing yêu cầu chăm sóc lại
                    </p>
                    {detail.mktSuggestion && (
                      <p className="text-sm text-foreground">{detail.mktSuggestion}</p>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1 w-fit rounded-full border border-gold/30 bg-accent px-4 text-accent-foreground hover:bg-accent/80"
                      onClick={handleResolveFollowup}
                      disabled={followupPending}
                    >
                      {followupPending && <LoaderCircle className="animate-spin" />}
                      Đánh dấu đã xử lý
                    </Button>
                  </div>
                )}

                <div className="flex flex-col">
                  <InfoRow label="Đối tượng" value={detail.customerObjectName} />
                  <InfoRow label="Cơ sở phụ trách" value={detail.assignedBranchCode} />
                  <InfoRow label="Cơ sở gợi ý" value={detail.suggestedBranchCode} />
                  <InfoRow label="Tư vấn viên" value={detail.consultantName ?? "Chưa gán"} />
                  {detail.reassignedByName && (
                    <InfoRow label="Điều chuyển bởi" value={`${detail.reassignedByName}${detail.reassignReason ? ` — ${detail.reassignReason}` : ""}`} />
                  )}
                  <InfoRow
                    label="SĐT"
                    value={
                      detail.phoneNormalized ? (
                        <span className="flex items-center justify-end gap-1.5 font-mono">
                          <PhoneCall className="size-3.5" />
                          {detail.phoneNormalized}
                          <CopyButton value={detail.phoneNormalized} label="Đã copy số điện thoại" />
                        </span>
                      ) : (
                        "Chưa có"
                      )
                    }
                  />
                  <InfoRow label="Lần chăm sóc" value={detail.touchCount} />
                  <InfoRow label="Tạo lúc" value={formatDateTime(detail.createdAt)} />
                  {detail.closedAt && <InfoRow label="Đóng lúc" value={formatDateTime(detail.closedAt)} />}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    className="rounded-full border-status-received/25 bg-status-received-bg/50 text-status-received hover:bg-status-received-bg"
                    render={<a href={detail.conversationLink ?? detail.canonicalLink} target="_blank" rel="noreferrer" />}
                  >
                    <MessageCircleMore className="size-3.5" />
                    {detail.conversationLink ? "Mở hội thoại" : "Mở trang khách"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    className="rounded-full border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    render={<a href={detail.canonicalLink} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink className="size-3.5" />
                    Link chuẩn
                  </Button>
                </div>

                {detail.touchLog.length > 0 && (
                  <>
                    <Separator className="my-5" />
                    <p className="mb-2 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <History className="size-3.5" /> Lịch sử chăm sóc
                    </p>
                    <div className="flex flex-col gap-2.5">
                      {detail.touchLog.map((t, i) => (
                        <div key={`${t.loggedAt}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                          <span className="text-foreground">{t.note || "Đã liên hệ khách"}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDateTime(t.loggedAt)} · {t.actorName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {detail.customerHistory.length > 0 && (
                  <>
                    <Separator className="my-5" />
                    <p className="mb-2 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Lượt tương tác khác của khách này
                    </p>
                    <div className="flex flex-col gap-2">
                      {detail.customerHistory.map((h) => (
                        <div
                          key={h.interactionId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{formatDateTime(h.createdLeadAt)}</span>
                          <StatusPill status={h.status} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {error && <FormMessage kind="error" className="mt-4">{error}</FormMessage>}
              </div>

              {(isOpenStatus || canReassign) && (
                <SheetFooter className="flex-row flex-wrap gap-2 border-t border-border bg-muted/40 px-6 py-4">
                  {isOpenStatus && (
                    <>
                      <TouchLogDialog onSubmit={handleLogTouch} pending={touchPending} className="rounded-full border-status-received/25 bg-status-received-bg/50 px-4 text-status-received hover:bg-status-received-bg" />
                      {detail.status === "Chờ" && (
                        <Button variant="secondary" size="sm" className="rounded-full bg-status-received-bg px-4 text-status-received hover:bg-status-received-bg/70" onClick={handleMoveToInProgress} disabled={touchPending}>
                          Chuyển Tiếp nhận
                        </Button>
                      )}
                    </>
                  )}
                  <div className="ml-auto flex gap-2">
                    {canReassign && (
                      <Button variant="outline" size="sm" className="rounded-full border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setReassignOpen(true)}>
                        <UserCog className="size-3.5" />
                        Điều chuyển
                      </Button>
                    )}
                    {isOpenStatus && (
                      <>
                        <Button variant="destructive" size="sm" className="rounded-full border border-destructive/20 bg-destructive/10 px-4 text-destructive hover:bg-destructive/20" onClick={() => setSpamOpen(true)}>
                          Spam
                        </Button>
                        <Button size="sm" className="glossy shadow-bubble rounded-full bg-status-qualified px-4 text-white hover:bg-status-qualified/90" onClick={() => setQualifyOpen(true)}>
                          Đủ tiêu chuẩn
                        </Button>
                      </>
                    )}
                  </div>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {detail && (
        <>
          <QualifyDialog
            open={qualifyOpen}
            onOpenChange={setQualifyOpen}
            interactionId={detail.interactionId}
            expectedVersion={detail.version}
            onDone={refresh}
          />
          <SpamDialog
            open={spamOpen}
            onOpenChange={setSpamOpen}
            interactionId={detail.interactionId}
            expectedVersion={detail.version}
            touchCount={detail.touchCount}
            onDone={refresh}
          />
          <ReassignDialog
            open={reassignOpen}
            onOpenChange={setReassignOpen}
            interactionId={detail.interactionId}
            expectedVersion={detail.version}
            currentAssignedEmail={detail.assignedSaleEmail}
            onDone={refresh}
          />
        </>
      )}
    </>
  );
}
