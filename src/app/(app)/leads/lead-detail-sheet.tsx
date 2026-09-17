"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  CalendarCheck2,
  CalendarPlus,
  ExternalLink,
  History,
  LoaderCircle,
  Maximize2,
  MessageCircleMore,
  PhoneCall,
  Signpost,
  Sparkles,
  Tag,
  UserCog,
  UserRound,
  type LucideIcon,
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
import { CopyButton } from "@/components/copy-button";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { QualifyDialog } from "@/app/(app)/leads/qualify-dialog";
import { SpamDialog } from "@/app/(app)/leads/spam-dialog";
import { ReassignDialog } from "@/app/(app)/leads/reassign-dialog";
import { ResolveFollowupDialog } from "@/app/(app)/leads/resolve-followup-dialog";

function MetaTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5 ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-condensed text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="truncate text-sm font-medium text-foreground" title={typeof value === "string" ? value : undefined}>{value}</span>
      </div>
    </div>
  );
}

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
    handleResolveFollowup,
    handleMoveToInProgress,
    refresh,
  } = useInteractionDetail(interactionId, onChanged);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [spamOpen, setSpamOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [resolveFollowupOpen, setResolveFollowupOpen] = useState(false);

  const open = interactionId !== null;
  const isOpenStatus = detail?.status === "Chờ" || detail?.status === "Tiếp nhận";
  const canReassign = detail?.permissions.canReassign ?? false;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl">
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
              <SheetHeader className="gap-3 border-b border-border px-6 py-5 pr-12">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received">
                    <MessageCircleMore className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SheetTitle className="text-lg">{detail.customerName}</SheetTitle>
                      <StatusPill status={detail.status} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={detail.interactionId}>{detail.interactionId}</p>
                  </div>
                </div>
                <SheetDescription className="sr-only">
                  {detail.sourceName} · {detail.fanpageName}
                  {detail.adId ? ` · Ad ${detail.adId}` : ""}
                </SheetDescription>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MetaTag>{detail.sourceName}</MetaTag>
                    <MetaTag>{detail.fanpageName}</MetaTag>
                    {detail.adId && <MetaTag>Ad {detail.adId}</MetaTag>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    nativeButton={false}
                    render={<Link href={`/leads/${detail.interactionId}`} />}
                  >
                    <Maximize2 className="size-3" />
                    Mở trang chi tiết
                  </Button>
                </div>
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
                      onClick={() => setResolveFollowupOpen(true)}
                      disabled={followupPending}
                    >
                      {followupPending && <LoaderCircle className="animate-spin" />}
                      Đánh dấu đã chăm sóc lại
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <InfoTile icon={Tag} label="Đối tượng" value={detail.customerObjectName} />
                  <InfoTile icon={UserRound} label="Tư vấn viên" value={detail.consultantName ?? "Chưa gán"} />
                  <InfoTile icon={Building2} label="Cơ sở phụ trách" value={detail.assignedBranchCode} />
                  {detail.suggestedBranchCode !== detail.assignedBranchCode && (
                    <InfoTile icon={Signpost} label="Cơ sở gợi ý" value={detail.suggestedBranchCode} />
                  )}
                </div>

                {detail.reassignedByName && (
                  <p className="mt-2.5 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Điều chuyển bởi {detail.reassignedByName}</span>
                    {detail.reassignReason ? ` — ${detail.reassignReason}` : ""}
                  </p>
                )}

                <Separator className="my-5" />

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
                  <span className="flex items-center gap-2 font-condensed text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <PhoneCall className="size-3.5" /> SĐT
                  </span>
                  {detail.phoneNormalized ? (
                    <span className="flex items-center gap-1.5 font-mono text-sm font-medium text-foreground">
                      {detail.phoneNormalized}
                      <CopyButton value={detail.phoneNormalized} label="Đã copy số điện thoại" />
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Chưa có</span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  <InfoTile className="min-w-36 flex-1" icon={CalendarPlus} label="Tạo lúc" value={formatDateTime(detail.createdAt)} />
                  {detail.closedAt && (
                    <InfoTile className="min-w-36 flex-1" icon={CalendarCheck2} label="Đóng lúc" value={formatDateTime(detail.closedAt)} />
                  )}
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
                    <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                      <p className="mb-2.5 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
                    </div>
                  </>
                )}

                {detail.customerHistory.length > 0 && (
                  <>
                    <Separator className="my-5" />
                    <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                      <p className="mb-2.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Lượt tương tác khác của khách này
                      </p>
                      <div className="flex flex-col gap-2">
                        {detail.customerHistory.map((h) => (
                          <div
                            key={h.interactionId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                          >
                            <span className="text-muted-foreground">{formatDateTime(h.createdLeadAt)}</span>
                            <StatusPill status={h.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {error && <FormMessage kind="error" className="mt-4">{error}</FormMessage>}
              </div>

              {(isOpenStatus || canReassign) && (
                <SheetFooter className="flex-row flex-nowrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-6 py-4">
                  <div className="flex flex-nowrap items-center gap-2">
                    {isOpenStatus && detail.status === "Chờ" && (
                      <Button variant="secondary" size="sm" className="rounded-full bg-status-received-bg px-4 text-status-received hover:bg-status-received-bg/70" onClick={handleMoveToInProgress} disabled={touchPending}>
                        Chuyển Tiếp nhận
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-nowrap items-center gap-2">
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
            hasConversationLink={!!detail.conversationLink}
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
          <ResolveFollowupDialog open={resolveFollowupOpen} onOpenChange={setResolveFollowupOpen} onConfirm={handleResolveFollowup} />
        </>
      )}
    </>
  );
}
