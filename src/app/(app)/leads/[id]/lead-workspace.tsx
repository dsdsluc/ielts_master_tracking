"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  History,
  LoaderCircle,
  MessageCircleMore,
  PhoneCall,
  Save,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  Autocomplete,
  AutocompleteClear,
  AutocompleteEmpty,
  AutocompleteIcon,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
  AutocompletePortal,
  AutocompletePositioner,
} from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormMessage } from "@/components/form-message";
import { StatusPill } from "@/components/status-pill";
import { InfoRow } from "@/app/(app)/leads/info-row";
import { CopyButton } from "@/app/(app)/leads/copy-button";
import { TouchLogDialog } from "@/app/(app)/leads/touch-log-dialog";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { useInteractionDetail } from "@/app/(app)/leads/use-interaction-detail";
import { detectSourceName, type LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import { updateInteractionInfo } from "@/app/(app)/leads/leads-api";
import type { DuplicateConflict } from "@/app/(app)/leads/types";
import { QualifyDialog } from "@/app/(app)/leads/qualify-dialog";
import { SpamDialog } from "@/app/(app)/leads/spam-dialog";
import { useToast } from "@/hooks/use-toast";

type EditForm = {
  rawLink: string;
  customerName: string;
  fanpageName: string;
  adId: string;
  customerObjectName: string;
  assignedBranchCode: string;
  conversationLink: string;
};

const EMPTY_FORM: EditForm = {
  rawLink: "",
  customerName: "",
  fanpageName: "",
  adId: "",
  customerObjectName: "",
  assignedBranchCode: "",
  conversationLink: "",
};

export function LeadWorkspace({ interactionId, options }: { interactionId: string; options: LeadFormOptions }) {
  const { toast } = useToast();
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
  } = useInteractionDetail(interactionId);
  const [qualifyOpen, setQualifyOpen] = useState(false);
  const [spamOpen, setSpamOpen] = useState(false);

  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDuplicate, setSaveDuplicate] = useState<DuplicateConflict["duplicate"] | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    // Chỉ đồng bộ form khi CHUYỂN sang 1 liên hệ khác (id đổi) — không phải mỗi
    // lần detail refresh sau 1 hành động (Ghi nhận/Tiếp nhận...), để không xoá
    // mất nội dung Sale đang gõ dở trong form chỉnh sửa.
    if (detail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        rawLink: detail.rawLink,
        customerName: detail.customerName,
        fanpageName: detail.fanpageName,
        adId: detail.adId ?? "",
        customerObjectName: detail.customerObjectName,
        assignedBranchCode: detail.assignedBranchCode,
        conversationLink: detail.conversationLink ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.interactionId]);

  function update<K extends keyof EditForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setJustSaved(false);
  }

  const detectedSourceName = useMemo(() => detectSourceName(form.rawLink, options.sourceDomains), [form.rawLink, options.sourceDomains]);
  const filteredFanpages = useMemo(
    () => (detectedSourceName ? options.fanpages.filter((f) => f.defaultSourceName === detectedSourceName) : options.fanpages),
    [detectedSourceName, options.fanpages]
  );
  const adItems = useMemo(
    () => options.adSuggestions.map((a) => ({ value: a.adId, label: a.adId, adName: a.adName })),
    [options.adSuggestions]
  );

  useEffect(() => {
    if (form.fanpageName && !filteredFanpages.some((f) => f.name === form.fanpageName)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      update("fanpageName", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFanpages]);

  async function handleSave(duplicateReason?: string) {
    if (!detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateInteractionInfo(detail.interactionId, {
        rawLink: form.rawLink,
        customerName: form.customerName,
        fanpageName: form.fanpageName,
        adId: form.adId || undefined,
        customerObjectName: form.customerObjectName,
        assignedBranchCode: form.assignedBranchCode,
        conversationLink: form.conversationLink || undefined,
        duplicateConfirmed: duplicateReason ? true : undefined,
        duplicateReason,
        expectedVersion: detail.version,
      });

      if ("status" in result && result.status === 409) {
        setSaveDuplicate(result.duplicate);
        return;
      }

      setSaveDuplicate(null);
      setJustSaved(true);
      toast.success("Đã lưu thay đổi.");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không lưu được thay đổi.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const isOpenStatus = detail?.status === "Chờ" || detail?.status === "Tiếp nhận";
  const canEdit = detail?.permissions.canEditInfo ?? false;

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
                  onClick={handleResolveFollowup}
                  disabled={followupPending}
                >
                  {followupPending && <LoaderCircle className="animate-spin" />}
                  Đánh dấu đã xử lý
                </Button>
              </div>
            )}

            <div className="shadow-bubble rounded-3xl border border-border bg-card p-6 sm:p-8 lg:p-10">
              <div className="mb-7 flex items-center justify-between gap-2">
                <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Thông tin liên hệ</h2>
                {!canEdit && <span className="text-xs text-muted-foreground">Chỉ xem — không thể chỉnh sửa hội thoại này</span>}
              </div>

              {canEdit ? (
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="edit-rawLink" className="text-base">Link khách hàng</Label>
                      {form.rawLink.trim() &&
                        (detectedSourceName ? (
                          <span className="rounded-full bg-status-received-bg px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-status-received uppercase">
                            Nguồn: {detectedSourceName}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-destructive uppercase">
                            <TriangleAlert className="size-3" /> Chưa nhận diện được nguồn
                          </span>
                        ))}
                    </div>
                    <Input id="edit-rawLink" value={form.rawLink} onChange={(e) => update("rawLink", e.target.value)} className="h-12 rounded-xl text-base" />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2.5">
                      <Label htmlFor="edit-customerName" className="text-base">Tên khách</Label>
                      <Input id="edit-customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} className="h-12 rounded-xl text-base" />
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <Label htmlFor="edit-adId" className="text-base">Ad ID (tuỳ chọn)</Label>
                      <Autocomplete
                        items={adItems}
                        value={form.adId}
                        onValueChange={(v) => update("adId", v)}
                        itemToStringValue={(item) => item.value}
                        filter={(item, query) => {
                          const q = query.trim().toLowerCase();
                          if (!q) return true;
                          return item.value.toLowerCase().includes(q) || item.adName.toLowerCase().includes(q);
                        }}
                        openOnInputClick
                      >
                        <AutocompleteInputGroup className="h-12">
                          <AutocompleteIcon>
                            <Search className="size-4" />
                          </AutocompleteIcon>
                          <AutocompleteInput id="edit-adId" placeholder="Dán hoặc tìm Ad ID / tên quảng cáo…" className="text-base" />
                          <AutocompleteClear />
                        </AutocompleteInputGroup>
                        <AutocompletePortal>
                          <AutocompletePositioner>
                            <AutocompletePopup>
                              <AutocompleteEmpty>
                                Chưa có Ad ID này trong danh sách — có thể quảng cáo chưa được đồng bộ, vẫn nhập/dán tay được.
                              </AutocompleteEmpty>
                              <AutocompleteList>
                                {(item: { value: string; label: string; adName: string }) => (
                                  <AutocompleteItem key={item.value} value={item}>
                                    <span className="truncate font-mono text-xs text-foreground">{item.value}</span>
                                    <span className="truncate text-xs text-muted-foreground">{item.adName}</span>
                                  </AutocompleteItem>
                                )}
                              </AutocompleteList>
                            </AutocompletePopup>
                          </AutocompletePositioner>
                        </AutocompletePortal>
                      </Autocomplete>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2.5">
                      <Label className="text-base">Fanpage</Label>
                      <Select value={form.fanpageName} onValueChange={(v) => update("fanpageName", v ?? "")}>
                        <SelectTrigger className="h-12 w-full rounded-xl text-base">
                          <SelectValue placeholder="Chọn fanpage" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredFanpages.map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <Label className="text-base">Đối tượng</Label>
                      <Select value={form.customerObjectName} onValueChange={(v) => update("customerObjectName", v ?? "")}>
                        <SelectTrigger className="h-12 w-full rounded-xl text-base">
                          <SelectValue placeholder="Chọn đối tượng" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.objects.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <Label className="text-base">Cơ sở phụ trách</Label>
                      <Select value={form.assignedBranchCode} onValueChange={(v) => update("assignedBranchCode", v ?? "")}>
                        <SelectTrigger className="h-12 w-full rounded-xl text-base">
                          <SelectValue placeholder="Chọn cơ sở" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.branches.map((b) => (
                            <SelectItem key={b.code} value={b.code}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <Label htmlFor="edit-conversationLink" className="text-base">Link hội thoại (tuỳ chọn)</Label>
                    <Input id="edit-conversationLink" value={form.conversationLink} onChange={(e) => update("conversationLink", e.target.value)} className="h-12 rounded-xl text-base" />
                  </div>

                  {saveDuplicate && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Nghi trùng với liên hệ <strong className="text-foreground">{saveDuplicate.customerName}</strong> tạo lúc{" "}
                        {new Date(saveDuplicate.createdLeadAt).toLocaleString("vi-VN")}
                        {saveDuplicate.assignedSaleName ? ` (${saveDuplicate.assignedSaleName})` : ""}. Vẫn muốn lưu?
                      </AlertDescription>
                    </Alert>
                  )}
                  {saveError && <FormMessage kind="error">{saveError}</FormMessage>}

                  <div className="flex items-center gap-3 pt-2">
                    {saveDuplicate ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="glossy h-11 rounded-full border-gold/40 bg-accent px-6 text-base text-accent-foreground hover:bg-accent/80"
                        disabled={saving}
                        onClick={() => handleSave("Sale xác nhận không trùng, vẫn lưu thay đổi")}
                      >
                        {saving && <LoaderCircle className="animate-spin" />}
                        Vẫn lưu thay đổi
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="glossy shadow-bubble h-11 rounded-full bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90"
                        disabled={saving}
                        onClick={() => handleSave()}
                      >
                        {saving ? <LoaderCircle className="animate-spin" /> : <Save className="size-4" />}
                        Lưu thay đổi
                      </Button>
                    )}
                    {justSaved && !saveDuplicate && <span className="text-xs text-status-qualified">Đã lưu.</span>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <InfoRow
                    label="Link khách hàng"
                    value={
                      <a className="underline underline-offset-2" href={detail.canonicalLink} target="_blank" rel="noreferrer">
                        {detail.rawLink}
                      </a>
                    }
                  />
                  <InfoRow label="Tên khách" value={detail.customerName} />
                  <InfoRow label="Fanpage" value={detail.fanpageName} />
                  <InfoRow label="Ad ID" value={detail.adId ?? "Chưa có"} />
                  <InfoRow label="Đối tượng" value={detail.customerObjectName} />
                  <InfoRow label="Cơ sở phụ trách" value={detail.assignedBranchCode} />
                </div>
              )}
            </div>

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
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Thông tin khác</h2>
              <InfoRow label="Cơ sở gợi ý" value={detail.suggestedBranchCode} />
              <InfoRow label="Tư vấn viên" value={detail.assignedSaleName ?? "Chưa gán"} />
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
            </div>

            {isOpenStatus && (
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-1 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Hành động</h2>
                <TouchLogDialog onSubmit={handleLogTouch} pending={touchPending} className="rounded-full border-status-received/25 bg-status-received-bg/50 text-status-received hover:bg-status-received-bg" />
                {detail.status === "Chờ" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full bg-status-received-bg text-status-received hover:bg-status-received-bg/70"
                    onClick={handleMoveToInProgress}
                    disabled={touchPending}
                  >
                    Chuyển Tiếp nhận
                  </Button>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="destructive" size="sm" className="flex-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => setSpamOpen(true)}>
                    Spam
                  </Button>
                  <Button size="sm" className="glossy shadow-bubble flex-1 rounded-full bg-status-qualified text-white hover:bg-status-qualified/90" onClick={() => setQualifyOpen(true)}>
                    Đủ tiêu chuẩn
                  </Button>
                </div>
              </div>
            )}

            {error && <FormMessage kind="error">{error}</FormMessage>}
          </div>
        </div>
      )}

      {detail && (
        <>
          <QualifyDialog open={qualifyOpen} onOpenChange={setQualifyOpen} interactionId={detail.interactionId} expectedVersion={detail.version} onDone={refresh} />
          <SpamDialog open={spamOpen} onOpenChange={setSpamOpen} interactionId={detail.interactionId} expectedVersion={detail.version} touchCount={detail.touchCount} onDone={refresh} />
        </>
      )}
    </>
  );
}
