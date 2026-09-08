"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, TriangleAlert, UserRoundPlus } from "lucide-react";
import { detectSourceName, type LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createInteraction } from "@/app/(app)/leads/leads-api";
import type { DuplicateConflict } from "@/app/(app)/leads/types";
import { useToast } from "@/hooks/use-toast";

export type { LeadFormOptions };

const EMPTY_FORM = {
  rawLink: "",
  customerName: "",
  fanpageName: "",
  adId: "",
  customerObjectName: "",
  assignedBranchCode: "",
  conversationLink: "",
};

export function NewLeadDialog({ options, onCreated }: { options: LeadFormOptions; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateConflict["duplicate"] | null>(null);

  const detectedSourceName = useMemo(() => detectSourceName(form.rawLink, options.sourceDomains), [form.rawLink, options.sourceDomains]);
  const filteredFanpages = useMemo(
    () => (detectedSourceName ? options.fanpages.filter((f) => f.defaultSourceName === detectedSourceName) : options.fanpages),
    [detectedSourceName, options.fanpages]
  );

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    // Link đổi -> Nguồn suy ra đổi theo -> Fanpage đã chọn có thể không còn
    // thuộc Nguồn đó nữa, phải bỏ chọn để tránh submit sai (thay vì chỉ report lỗi sau khi bấm Tạo).
    if (form.fanpageName && !filteredFanpages.some((f) => f.name === form.fanpageName)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      update("fanpageName", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFanpages]);

  function reset() {
    setForm(EMPTY_FORM);
    setError(null);
    setDuplicate(null);
  }

  async function submit(duplicateReason?: string) {
    setPending(true);
    setError(null);
    try {
      const result = await createInteraction({
        rawLink: form.rawLink,
        customerName: form.customerName,
        fanpageName: form.fanpageName,
        adId: form.adId || undefined,
        customerObjectName: form.customerObjectName,
        assignedBranchCode: form.assignedBranchCode,
        conversationLink: form.conversationLink || undefined,
        duplicateConfirmed: duplicateReason ? true : undefined,
        duplicateReason,
      });

      if ("status" in result && result.status === 409) {
        setDuplicate(result.duplicate);
        return;
      }

      setOpen(false);
      reset();
      toast.success("Đã tạo liên hệ mới.");
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tạo được liên hệ.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button className="glossy shadow-bubble h-10 rounded-full bg-status-received px-4 text-white hover:bg-status-received/90" />}>
        <Plus className="size-4" />
        Thêm liên hệ mới
      </DialogTrigger>
      <DialogContent className="shadow-bubble max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-status-received/15 bg-card/98 p-6 backdrop-blur-xl sm:max-w-3xl sm:p-8 lg:max-w-5xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
          <DialogHeader className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-0.5 pr-8">
            <span className="glossy row-span-2 flex size-12 items-center justify-center rounded-full bg-status-received text-white">
              <UserRoundPlus className="size-5" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-primary uppercase">Khách mới</p>
            <DialogTitle className="text-xl">Tạo lượt tương tác</DialogTitle>
          </DialogHeader>

          <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="rawLink">Link khách hàng</Label>
                {form.rawLink.trim() && (
                  detectedSourceName ? (
                    <span className="rounded-full bg-status-received-bg px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-status-received uppercase">
                      Nguồn: {detectedSourceName}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-destructive uppercase">
                      <TriangleAlert className="size-3" /> Chưa nhận diện được nguồn
                    </span>
                  )
                )}
              </div>
              <Input id="rawLink" value={form.rawLink} onChange={(e) => update("rawLink", e.target.value)} placeholder="https://facebook.com/..." required className="h-11 rounded-xl bg-secondary/40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customerName">Tên khách</Label>
              <Input id="customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required className="h-11 rounded-xl bg-secondary/40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adId">Ad ID (tuỳ chọn)</Label>
              <Input id="adId" value={form.adId} onChange={(e) => update("adId", e.target.value)} className="h-11 rounded-xl bg-secondary/40" />
            </div>
          </div>

          <div className="h-px bg-border/60" />

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Fanpage</Label>
              <Select value={form.fanpageName} onValueChange={(v) => update("fanpageName", v ?? "")}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
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
            <div className="flex flex-col gap-1.5">
              <Label>Đối tượng</Label>
              <Select value={form.customerObjectName} onValueChange={(v) => update("customerObjectName", v ?? "")}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
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
            <div className="flex flex-col gap-1.5">
              <Label>Cơ sở phụ trách</Label>
              <Select value={form.assignedBranchCode} onValueChange={(v) => update("assignedBranchCode", v ?? "")}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conversationLink">Link hội thoại (tuỳ chọn)</Label>
            <Input
              id="conversationLink"
              value={form.conversationLink}
              onChange={(e) => update("conversationLink", e.target.value)}
              placeholder="Chỉ để mở nhanh — không dùng để kiểm tra trùng"
              className="h-11 rounded-xl bg-secondary/40"
            />
          </div>

          {duplicate && (
            <Alert variant="destructive">
              <AlertDescription>
                Nghi trùng với liên hệ <strong className="text-foreground">{duplicate.customerName}</strong> tạo lúc{" "}
                {new Date(duplicate.createdLeadAt).toLocaleString("vi-VN")}
                {duplicate.assignedSaleName ? ` (${duplicate.assignedSaleName})` : ""}. Vẫn muốn tạo mới?
              </AlertDescription>
            </Alert>
          )}

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            {duplicate ? (
              <Button
                type="button"
                variant="outline"
                className="glossy rounded-full border-gold/40 bg-accent px-5 text-accent-foreground hover:bg-accent/80"
                disabled={pending}
                onClick={() => submit("Sale xác nhận không trùng, vẫn tạo mới")}
              >
                {pending && <LoaderCircle className="animate-spin" />}
                Vẫn tạo liên hệ mới
              </Button>
            ) : (
              <Button type="submit" className="glossy shadow-bubble rounded-full bg-status-received px-5 text-white hover:bg-status-received/90" disabled={pending}>
                {pending && <LoaderCircle className="animate-spin" />}
                Tạo lượt tương tác
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
