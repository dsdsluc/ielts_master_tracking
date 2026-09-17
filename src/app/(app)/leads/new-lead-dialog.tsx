"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, LoaderCircle, Phone, PhoneCall, Plus, TriangleAlert, UserRoundPlus } from "lucide-react";
import { detectSourceName, type LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import { EXTERNAL_LEAD_SOURCES } from "@/lib/interactions/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createInteraction } from "@/app/(app)/leads/leads-api";
import type { DuplicateConflict } from "@/app/(app)/leads/types";
import { useToast } from "@/hooks/use-toast";

export type { LeadFormOptions };

type Channel = "facebook" | "external";

/** Đánh dấu trường bắt buộc — đặt ngay sau text của Label. */
function Req() {
  return (
    <span className="text-destructive" aria-hidden>
      {" "}
      *
    </span>
  );
}

const EMPTY_FORM = {
  // Facebook
  rawLink: "",
  hasAdId: false,
  adId: "",
  fanpageName: "",
  conversationLink: "",
  // Ngoài
  sourceName: "",
  // Dùng chung
  customerName: "",
  customerObjectName: "",
  assignedBranchCode: "",
  phoneRaw: "",
};

export function NewLeadDialog({ options, onCreated }: { options: LeadFormOptions; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("facebook");
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateConflict["duplicate"] | null>(null);

  const detectedSourceName = useMemo(() => detectSourceName(form.rawLink, options.sourceDomains), [form.rawLink, options.sourceDomains]);
  const filteredFanpages = useMemo(
    () => (detectedSourceName ? options.fanpages.filter((f) => f.defaultSourceName === detectedSourceName) : options.fanpages),
    [detectedSourceName, options.fanpages]
  );

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
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
    setChannel("facebook");
    setError(null);
    setDuplicate(null);
  }

  async function submit(duplicateReason?: string) {
    setPending(true);
    setError(null);
    try {
      const result = await createInteraction(
        channel === "facebook"
          ? {
              channel: "facebook",
              rawLink: form.rawLink,
              customerName: form.customerName,
              fanpageName: form.fanpageName,
              adId: form.hasAdId ? form.adId || undefined : undefined,
              customerObjectName: form.customerObjectName,
              assignedBranchCode: form.assignedBranchCode,
              conversationLink: form.conversationLink || undefined,
              phoneRaw: form.phoneRaw || undefined,
              duplicateConfirmed: duplicateReason ? true : undefined,
              duplicateReason,
            }
          : {
              channel: "external",
              customerName: form.customerName,
              sourceName: form.sourceName,
              phoneRaw: form.phoneRaw,
              assignedBranchCode: form.assignedBranchCode,
              customerObjectName: form.customerObjectName || undefined,
              duplicateConfirmed: duplicateReason ? true : undefined,
              duplicateReason,
            }
      );

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

          <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <TabsList className="h-auto w-full gap-1.5 rounded-2xl bg-secondary/70 p-1.5 sm:w-fit">
              <TabsTrigger
                value="facebook"
                className="h-11 gap-2 rounded-xl px-6 text-sm font-semibold data-active:bg-card data-active:text-status-received data-active:shadow-md"
              >
                <Link2 className="size-4" /> Facebook
              </TabsTrigger>
              <TabsTrigger
                value="external"
                className="h-11 gap-2 rounded-xl px-6 text-sm font-semibold data-active:bg-card data-active:text-status-received data-active:shadow-md"
              >
                <PhoneCall className="size-4" /> Ngoài
              </TabsTrigger>
            </TabsList>

            <TabsContent value="facebook" className="flex flex-col gap-7 pt-3">
              <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="rawLink">
                      Link profile khách hàng
                      <Req />
                    </Label>
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
                  <Input
                    id="rawLink"
                    value={form.rawLink}
                    onChange={(e) => update("rawLink", e.target.value)}
                    placeholder="https://facebook.com/..."
                    required={channel === "facebook"}
                    className="h-11 rounded-xl bg-secondary/40"
                  />
                </div>
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                  <Label htmlFor="conversationLink">
                    Link cuộc hội thoại
                    <Req />
                  </Label>
                  <Input
                    id="conversationLink"
                    value={form.conversationLink}
                    onChange={(e) => update("conversationLink", e.target.value)}
                    placeholder="Link nhắn tin với khách trên Messenger/Inbox"
                    required={channel === "facebook"}
                    className="h-11 rounded-xl bg-secondary/40"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fb-customerName">
                    Tên khách
                    <Req />
                  </Label>
                  <Input id="fb-customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required={channel === "facebook"} className="h-11 rounded-xl bg-secondary/40" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fb-phoneRaw">Số điện thoại (nếu có)</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fb-phoneRaw"
                      value={form.phoneRaw}
                      onChange={(e) => update("phoneRaw", e.target.value)}
                      placeholder="09xxxxxxxx — bỏ trống nếu chưa có"
                      className="h-11 rounded-xl bg-secondary/40 pl-10 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="hasAdId" checked={form.hasAdId} onCheckedChange={(c) => update("hasAdId", c === true)} />
                  <Label htmlFor="hasAdId" className="cursor-pointer font-normal">
                    Liên hệ này có Ad ID
                  </Label>
                </div>
                {form.hasAdId && (
                  <Input
                    id="adId"
                    value={form.adId}
                    onChange={(e) => update("adId", e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Nhập số Ad ID"
                    aria-label="Ad ID"
                    inputMode="numeric"
                    className="h-11 w-full max-w-xs rounded-xl bg-secondary/40 font-mono sm:w-auto"
                  />
                )}
              </div>

              <div className="h-px bg-border/60" />

              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fb-fanpage">
                    Fanpage
                    <Req />
                  </Label>
                  <Select
                    value={form.fanpageName}
                    onValueChange={(v) => update("fanpageName", v ?? "")}
                    items={filteredFanpages.map((f) => ({ value: f.name, label: f.name }))}
                  >
                    <SelectTrigger id="fb-fanpage" className="h-11 w-full rounded-xl bg-background">
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
                  <Label htmlFor="fb-object">Đối tượng</Label>
                  <Select
                    value={form.customerObjectName}
                    onValueChange={(v) => update("customerObjectName", v ?? "")}
                    items={options.objects.map((o) => ({ value: o, label: o }))}
                  >
                    <SelectTrigger id="fb-object" className="h-11 w-full rounded-xl bg-background">
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
                  <Label htmlFor="fb-branch">Cơ sở phụ trách</Label>
                  <Select
                    value={form.assignedBranchCode}
                    onValueChange={(v) => update("assignedBranchCode", v ?? "")}
                    items={options.branches.map((b) => ({ value: b.code, label: b.name }))}
                  >
                    <SelectTrigger id="fb-branch" className="h-11 w-full rounded-xl bg-background">
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
            </TabsContent>

            <TabsContent value="external" className="flex flex-col gap-5 pt-3">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-customerName">
                    Tên khách
                    <Req />
                  </Label>
                  <Input id="ext-customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required={channel === "external"} className="h-11 rounded-xl bg-secondary/40" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-phoneRaw">
                    Số điện thoại
                    <Req />
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ext-phoneRaw"
                      value={form.phoneRaw}
                      onChange={(e) => update("phoneRaw", e.target.value)}
                      placeholder="09xxxxxxxx"
                      required={channel === "external"}
                      className="h-11 rounded-xl bg-secondary/40 pl-10 font-mono"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-source">
                    Nguồn
                    <Req />
                  </Label>
                  <Select
                    value={form.sourceName}
                    onValueChange={(v) => update("sourceName", v ?? "")}
                    items={EXTERNAL_LEAD_SOURCES.map((s) => ({ value: s, label: s }))}
                  >
                    <SelectTrigger id="ext-source" className="h-11 w-full rounded-xl bg-background">
                      <SelectValue placeholder="Chọn nguồn" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXTERNAL_LEAD_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-branch">
                    Cơ sở phụ trách
                    <Req />
                  </Label>
                  <Select
                    value={form.assignedBranchCode}
                    onValueChange={(v) => update("assignedBranchCode", v ?? "")}
                    items={options.branches.map((b) => ({ value: b.code, label: b.name }))}
                  >
                    <SelectTrigger id="ext-branch" className="h-11 w-full rounded-xl bg-background">
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
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ext-object">Đối tượng (tuỳ chọn)</Label>
                  <Select
                    value={form.customerObjectName}
                    onValueChange={(v) => update("customerObjectName", v ?? "")}
                    items={options.objects.map((o) => ({ value: o, label: o }))}
                  >
                    <SelectTrigger id="ext-object" className="h-11 w-full rounded-xl bg-background">
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
              </div>
            </TabsContent>
          </Tabs>

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
