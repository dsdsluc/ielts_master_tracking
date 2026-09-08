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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormMessage } from "@/components/form-message";
import { createSource, updateSource } from "@/app/(app)/admin/sources/actions";

type SourceFormValues = {
  channelGroup: string;
  sourceGroup: string;
  requireAdId: boolean;
  note: string;
};

const EMPTY: SourceFormValues = { channelGroup: "", sourceGroup: "", requireAdId: false, note: "" };

export function SourceDialog({
  mode,
  source,
}: {
  mode: "create" | "edit";
  source?: { name: string; channelGroup: string; sourceGroup: string; requireAdId: boolean; note: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(source?.name ?? "");
  const [form, setForm] = useState<SourceFormValues>(
    source ? { channelGroup: source.channelGroup, sourceGroup: source.sourceGroup, requireAdId: source.requireAdId, note: source.note ?? "" } : EMPTY
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SourceFormValues>(key: K, value: SourceFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    if (!source) {
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
        await createSource({ name, ...form, note: form.note || undefined });
      } else if (source) {
        await updateSource(source.name, { ...form, note: form.note || undefined });
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
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Sửa nguồn" />
          )
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="size-4" /> Thêm nguồn mới
          </>
        ) : (
          <Pencil className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Thêm nguồn mới" : `Sửa nguồn: ${source?.name}`}</DialogTitle>
          </DialogHeader>

          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-name">Tên nguồn</Label>
              <Input id="source-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Facebook" required className="h-10 rounded-xl" />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-channel">Nhóm kênh</Label>
              <Input id="source-channel" value={form.channelGroup} onChange={(e) => update("channelGroup", e.target.value)} placeholder="Mạng xã hội" required className="h-10 rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-group">Nhóm nguồn</Label>
              <Input id="source-group" value={form.sourceGroup} onChange={(e) => update("sourceGroup", e.target.value)} placeholder="Tự nhiên" required className="h-10 rounded-xl" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Bắt buộc Ad ID</span>
              <span className="text-xs text-muted-foreground">Yêu cầu nhập Ad ID khi tạo liên hệ từ nguồn này</span>
            </div>
            <Switch checked={form.requireAdId} onCheckedChange={(v) => update("requireAdId", v)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source-note">Ghi chú (tuỳ chọn)</Label>
            <Input id="source-note" value={form.note} onChange={(e) => update("note", e.target.value)} className="h-10 rounded-xl" />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {mode === "create" ? "Tạo nguồn" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
