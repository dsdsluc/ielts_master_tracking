"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, History, Send, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { ContactInfoCard, FIELD_LABELS, fieldKind, getFieldValue } from "@/app/(app)/leads/contact-info-card";
import { OtherInfoCard } from "@/app/(app)/leads/other-info-card";
import { EditFieldDialog } from "@/app/(app)/leads/edit-field-dialog";
import { useContactInfoEditor } from "@/app/(app)/leads/use-contact-info-editor";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { resolveFollowup } from "@/app/(app)/leads/leads-api";
import type { LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import { QualifyDialog } from "@/app/(app)/leads/qualify-dialog";
import { SpamDialog } from "@/app/(app)/leads/spam-dialog";
import { ResolveFollowupDialog } from "@/app/(app)/leads/resolve-followup-dialog";
import type { InteractionDetail } from "@/app/(app)/leads/types";
import type { FollowupHistoryEntry } from "@/lib/interactions/queries";
import { useToast } from "@/hooks/use-toast";

const ACTION_LABEL: Record<string, string> = {
  FOLLOWUP_PUSH: "Marketing gửi yêu cầu chăm sóc lại",
  FOLLOWUP_ASSIGN: "Leader phân bổ yêu cầu cho Sale",
  FOLLOWUP_RESOLVED: "Sale đánh dấu đã chăm sóc lại",
};

const ACTION_ICON: Record<string, typeof Send> = {
  FOLLOWUP_PUSH: Send,
  FOLLOWUP_ASSIGN: UserRound,
  FOLLOWUP_RESOLVED: CheckCircle2,
};

export function FollowupDetailView({
  detail,
  history,
  options,
}: {
  detail: InteractionDetail;
  history: FollowupHistoryEntry[];
  options: LeadFormOptions;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [spamOpen, setSpamOpen] = useState(false);
  const [qualifyOpen, setQualifyOpen] = useState(false);

  const {
    editingField,
    editDialogOpen,
    setEditDialogOpen,
    detectedSourceName,
    openEditDialog,
    fieldSelectOptions,
    handleFieldSave,
  } = useContactInfoEditor(detail, options, () => router.refresh());

  const canEdit = detail.permissions.canEditInfo;

  async function handleResolve(note: string) {
    await resolveFollowup(detail.interactionId, note);
    toast.success("Đã đánh dấu chăm sóc lại — liên hệ chuyển sang Có nhu cầu.");
    router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/followup-inbox" />}
          aria-label="Quay lại Cần chăm sóc lại"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Vận hành · Cần chăm sóc lại</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-foreground">{detail.customerName}</h1>
            <StatusPill status={detail.status} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">
              <History className="size-3.5" /> Lịch sử chăm sóc lại
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có lịch sử nào.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((h, i) => {
                  const isSaleSide = h.action === "FOLLOWUP_RESOLVED";
                  const Icon = ACTION_ICON[h.action] ?? Sparkles;
                  return (
                    <div key={i} className={`flex ${isSaleSide ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-3 ${
                          isSaleSide ? "bg-status-qualified-bg text-foreground" : "bg-secondary/60 text-foreground"
                        }`}
                      >
                        <p
                          className={`flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${
                            isSaleSide ? "text-status-qualified" : "text-status-received"
                          }`}
                        >
                          <Icon className="size-3.5" />
                          {ACTION_LABEL[h.action] ?? h.action}
                        </p>
                        {h.suggestion && <p className="text-sm text-foreground">Gợi ý từ Marketing: {h.suggestion}</p>}
                        {h.note && <p className="text-sm text-foreground">Ghi chú: {h.note}</p>}
                        <p className="text-[11px] text-muted-foreground">
                          {h.actorName} · {formatDateTime(h.loggedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ContactInfoCard detail={detail} canEdit={canEdit} detectedSourceName={detectedSourceName} onEdit={openEditDialog} />
        </div>

        <div className="flex flex-col gap-6">
          <OtherInfoCard detail={detail} />

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Xử lý yêu cầu chăm sóc lại</h2>
            {detail.needsFollowup ? (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="glossy shadow-bubble rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setResolveOpen(true)}
                >
                  Đánh dấu đã chăm sóc lại
                </Button>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    onClick={() => setSpamOpen(true)}
                  >
                    Spam
                  </Button>
                  <Button
                    size="sm"
                    className="glossy shadow-bubble flex-1 rounded-full bg-status-qualified text-white hover:bg-status-qualified/90"
                    onClick={() => setQualifyOpen(true)}
                  >
                    Đủ tiêu chuẩn
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-status-qualified-bg px-4 py-3 text-sm font-medium text-status-qualified">
                <CheckCircle2 className="size-4 shrink-0" />
                Đã hoàn thành chăm sóc lại — không còn thao tác nào ở đây nữa.
              </div>
            )}
          </div>
        </div>
      </div>

      <ResolveFollowupDialog open={resolveOpen} onOpenChange={setResolveOpen} onConfirm={handleResolve} />
      <SpamDialog
        open={spamOpen}
        onOpenChange={setSpamOpen}
        interactionId={detail.interactionId}
        expectedVersion={detail.version}
        hasConversationLink={!!detail.conversationLink}
        onDone={() => router.refresh()}
      />
      <QualifyDialog
        open={qualifyOpen}
        onOpenChange={setQualifyOpen}
        interactionId={detail.interactionId}
        expectedVersion={detail.version}
        onDone={() => router.refresh()}
      />
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
  );
}
