"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormMessage } from "@/components/form-message";
import { createFanpage, updateFanpage } from "@/app/(app)/admin/fanpages/actions";

type FanpageFormValues = {
  defaultSourceName: string;
  suggestedBranchCode: string;
  requireAdId: boolean;
  note: string;
};

const EMPTY: FanpageFormValues = { defaultSourceName: "", suggestedBranchCode: "", requireAdId: false, note: "" };

export function FanpageDialog({
  mode,
  fanpage,
  sourceOptions,
  branchOptions,
}: {
  mode: "create" | "edit";
  fanpage?: { name: string; defaultSourceName: string; suggestedBranchCode: string; requireAdId: boolean; note: string | null };
  sourceOptions: string[];
  branchOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fanpage?.name ?? "");
  const [form, setForm] = useState<FanpageFormValues>(
    fanpage
      ? { defaultSourceName: fanpage.defaultSourceName, suggestedBranchCode: fanpage.suggestedBranchCode, requireAdId: fanpage.requireAdId, note: fanpage.note ?? "" }
      : EMPTY
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FanpageFormValues>(key: K, value: FanpageFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    if (!fanpage) {
      setName("");
      setForm(EMPTY);
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "create") {
        await createFanpage({ name, ...form, note: form.note || undefined });
      } else if (fanpage) {
        await updateFanpage(fanpage.name, { ...form, note: form.note || undefined });
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button className="rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90" />
          ) : (
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Sửa fanpage" />
          )
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="size-4" /> Thêm fanpage mới
          </>
        ) : (
          <Pencil className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Thêm fanpage mới" : `Sửa fanpage: ${fanpage?.name}`}</DialogTitle>
          </DialogHeader>

          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fanpage-name">Tên fanpage</Label>
              <Input id="fanpage-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="IELTS Master Bình Dương" required className="h-10 rounded-xl" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Nguồn mặc định</Label>
            <Select value={form.defaultSourceName} onValueChange={(v) => update("defaultSourceName", v ?? "")}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder="Chọn nguồn" />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Cơ sở gợi ý</Label>
            <Select value={form.suggestedBranchCode} onValueChange={(v) => update("suggestedBranchCode", v ?? "")}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <SelectValue placeholder="Chọn cơ sở" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Bắt buộc Ad ID</span>
              <span className="text-xs text-muted-foreground">Yêu cầu nhập Ad ID khi tạo liên hệ từ fanpage này</span>
            </div>
            <Switch checked={form.requireAdId} onCheckedChange={(v) => update("requireAdId", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fanpage-note">Ghi chú (tuỳ chọn)</Label>
            <Input id="fanpage-note" value={form.note} onChange={(e) => update("note", e.target.value)} className="h-10 rounded-xl" />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {mode === "create" ? "Tạo fanpage" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
