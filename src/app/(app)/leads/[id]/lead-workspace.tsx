"use client";

import Link from "next/link";
import { cloneElement, useState, type ReactElement } from "react";
import { ArrowLeft, History, LoaderCircle, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FormMessage } from "@/components/form-message";
import { StatusPill } from "@/components/status-pill";
import { ContactInfoCard, FIELD_LABELS, fieldKind, getFieldValue } from "@/app/(app)/leads/contact-info-card";
import { OtherInfoCard } from "@/app/(app)/leads/other-info-card";
import { EditFieldDialog } from "@/app/(app)/leads/edit-field-dialog";
import { useContactInfoEditor } from "@/app/(app)/leads/use-contact-info-editor";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { useInteractionDetail } from "@/app/(app)/leads/use-interaction-detail";
import type { LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import { QualifyDialog } from "@/app/(app)/leads/qualify-dialog";
import { SpamDialog } from "@/app/(app)/leads/spam-dialog";
import { ResolveFollowupDialog } from "@/app/(app)/leads/resolve-followup-dialog";

/** Bọc 1 action button đã bị khoá (hết áp dụng theo trạng thái hiện tại) bằng
 * Tooltip giải thích lý do — KHÔNG đổi kích thước/layout: không bọc thêm span,
 * không đổi className của Button. Cố tình không dùng `disabled` thật (Button
 * disabled có `pointer-events-none`, xem button.tsx, nên sẽ không bao giờ
 * hover tới được để hiện tooltip) — thay vào đó tắt hẳn onClick + đánh dấu
 * aria-disabled ngay trên chính Button qua cloneElement, giữ nguyên mọi class. */
function LockableAction({
  locked,
  reason,
  children,
}: {
  locked: boolean;
  reason: string;
  children: ReactElement<{ className?: string; onClick?: () => void }>;
}) {
  if (!locked) return children;
  const lockedChild = cloneElement(children, {
    onClick: undefined,
    "aria-disabled": true,
    className: `${children.props.className ?? ""} cursor-not-allowed opacity-50`,
  } as Partial<{ className?: string; onClick?: () => void }>);
  return (
    <Tooltip>
      <TooltipTrigger render={lockedChild} />
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function LeadWorkspace({ interactionId, options }: { interactionId: string; options: LeadFormOptions }) {
  const {
    detail,
    loading,
    error,
    touchPending,
    followupPending,
    handleResolveFollowup,
    handleMoveToInProgress,
    refresh,
  } = useInteractionDetail(interactionId);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [spamOpen, setSpamOpen] = useState(false);
  const [resolveFollowupOpen, setResolveFollowupOpen] = useState(false);

  const {
    editingField,
    editDialogOpen,
    setEditDialogOpen,
    detectedSourceName,
    openEditDialog,
    fieldSelectOptions,
    handleFieldSave,
  } = useContactInfoEditor(detail, options, refresh);

  const canEdit = detail?.permissions.canEditInfo ?? false;

  // Mỗi action chỉ áp dụng đúng 1 lần theo vòng đời trạng thái — bấm xong thì
  // khoá lại, tránh gây hiểu lầm là bấm được nữa/nhấn lại vô hại.
  const isWaiting = detail?.status === "Chờ";
  const isClosed = detail?.status === "Đủ tiêu chuẩn" || detail?.status === "Spam";
  const moveToProcessingLocked = !isWaiting;
  const moveToProcessingReason = isClosed ? "Liên hệ đã đóng, không thể chuyển Có nhu cầu." : "Đã chuyển sang Có nhu cầu.";
  const missingConversationLink = !detail?.conversationLink;
  const spamLocked = isClosed || missingConversationLink;
  const spamReason = isClosed
    ? detail?.status === "Spam"
      ? "Đã đánh dấu Spam."
      : "Liên hệ đã Đủ tiêu chuẩn, không thể chuyển Spam."
    : "Chưa có link cuộc hội thoại — không thể đánh dấu Spam.";
  const qualifyLocked = isClosed;
  const qualifyReason = detail?.status === "Đủ tiêu chuẩn" ? "Đã đánh dấu Đủ tiêu chuẩn." : "Liên hệ đã Spam, không thể chuyển Đủ tiêu chuẩn.";

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/leads" />}
          aria-label="Quay lại danh sách liên hệ"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Vận hành · Liên hệ</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-foreground">{detail?.customerName ?? "Đang tải…"}</h1>
            {detail && <StatusPill status={detail.status} />}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && !detail && <FormMessage kind="error">{error}</FormMessage>}

      {!loading && detail && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-6">
            {detail.needsFollowup && (
              <div className="flex flex-col gap-2 rounded-2xl border border-accent bg-accent/40 p-4">
                <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                  <Sparkles className="size-3.5" /> Marketing yêu cầu chăm sóc lại
                </p>
                {detail.mktSuggestion && <p className="text-sm text-foreground">{detail.mktSuggestion}</p>}
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

            <ContactInfoCard detail={detail} canEdit={canEdit} detectedSourceName={detectedSourceName} onEdit={openEditDialog} />

            {(detail.touchLog.length > 0 || detail.customerHistory.length > 0) && (
              <div className="rounded-2xl border border-border bg-card p-5">
                {detail.touchLog.length > 0 && (
                  <>
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

                {detail.touchLog.length > 0 && detail.customerHistory.length > 0 && <Separator className="my-5" />}

                {detail.customerHistory.length > 0 && (
                  <>
                    <p className="mb-2 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Lượt tương tác khác của khách này
                    </p>
                    <div className="flex flex-col gap-2">
                      {detail.customerHistory.map((h) => (
                        <div key={h.interactionId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{formatDateTime(h.createdLeadAt)}</span>
                          <StatusPill status={h.status} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {detail.fieldChangeLog.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-2 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <History className="size-3.5" /> Lịch sử chỉnh sửa thông tin
                </p>
                <div className="flex flex-col gap-2.5">
                  {detail.fieldChangeLog.map((entry, i) => (
                    <div key={`${entry.changedAt}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-foreground">
                        <strong className="font-medium">{entry.changedByName}</strong> đã thay đổi{" "}
                        <strong className="font-medium">{entry.fieldLabel}</strong>
                        {(entry.oldValue || entry.newValue) && (
                          <span className="block text-xs text-muted-foreground">
                            {entry.oldValue ?? "—"} → {entry.newValue ?? "—"}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.changedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.emailMessages.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-2 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <Mail className="size-3.5" /> Email đã gửi
                </p>
                <div className="flex flex-col gap-2.5">
                  {detail.emailMessages.map((m) => (
                    <details key={m.id} className="group rounded-lg border border-border px-3 py-2">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm">
                        <span className="text-foreground">{m.subject}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(m.sentAt)} · {m.sentByName ?? "Hệ thống"}
                        </span>
                      </summary>
                      <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                        <p className="mb-1.5">
                          Tới: {m.toEmail}
                          {m.bccEmails.length > 0 ? ` · Bcc: ${m.bccEmails.join(", ")}` : ""}
                        </p>
                        <div className="rounded-md bg-secondary/40 p-3 text-foreground" dangerouslySetInnerHTML={{ __html: m.html }} />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <OtherInfoCard detail={detail} />

            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Hành động</h2>
              <LockableAction locked={moveToProcessingLocked} reason={moveToProcessingReason}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full bg-status-received-bg text-status-received hover:bg-status-received-bg/70"
                  onClick={handleMoveToInProgress}
                  disabled={touchPending}
                >
                  Có nhu cầu
                </Button>
              </LockableAction>
              <div className="flex gap-2 pt-1">
                <LockableAction locked={spamLocked} reason={spamReason}>
                  <Button variant="destructive" size="sm" className="flex-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => setSpamOpen(true)}>
                    Spam
                  </Button>
                </LockableAction>
                <LockableAction locked={qualifyLocked} reason={qualifyReason}>
                  <Button size="sm" className="glossy shadow-bubble flex-1 rounded-full bg-status-qualified text-white hover:bg-status-qualified/90" onClick={() => setQualifyOpen(true)}>
                    Đủ tiêu chuẩn
                  </Button>
                </LockableAction>
              </div>
            </div>

            {error && <FormMessage kind="error">{error}</FormMessage>}
          </div>
        </div>
      )}

      {detail && (
        <>
          <QualifyDialog open={qualifyOpen} onOpenChange={setQualifyOpen} interactionId={detail.interactionId} expectedVersion={detail.version} onDone={refresh} />
          <SpamDialog
            open={spamOpen}
            onOpenChange={setSpamOpen}
            interactionId={detail.interactionId}
            expectedVersion={detail.version}
            hasConversationLink={!!detail.conversationLink}
            onDone={refresh}
          />
          <ResolveFollowupDialog open={resolveFollowupOpen} onOpenChange={setResolveFollowupOpen} onConfirm={handleResolveFollowup} />
          <EditFieldDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            label={FIELD_LABELS[editingField ?? "customerName"]}
            kind={fieldKind(editingField ?? "customerName")}
            currentValue={getFieldValue(editingField ?? "customerName", detail)}
            selectOptions={fieldSelectOptions(editingField ?? "customerName")}
            onSave={(newValue, duplicateReason) => handleFieldSave(editingField ?? "customerName", newValue, duplicateReason)}
          />
        </>
      )}
    </>
  );
}
