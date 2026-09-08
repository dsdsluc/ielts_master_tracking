"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Megaphone, Pencil, Plus } from "lucide-react";
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
import { FormMessage } from "@/components/form-message";
import { createAdsCost, updateAdsCost } from "@/app/(app)/ads-cost/actions";

export type AdsCostRow = {
  id: number;
  periodStart: string;
  periodEnd: string;
  adId: string;
  adName: string;
  sourceName: string | null;
  fanpageName: string | null;
  branchCode: string | null;
  costVnd: string;
  note: string | null;
};

type AdsCostFormValues = {
  periodStart: string;
  periodEnd: string;
  adId: string;
  adName: string;
  sourceName: string;
  fanpageName: string;
  branchCode: string;
  costVnd: string;
  note: string;
};

const EMPTY: AdsCostFormValues = {
  periodStart: "",
  periodEnd: "",
  adId: "",
  adName: "",
  sourceName: "none",
  fanpageName: "none",
  branchCode: "none",
  costVnd: "",
  note: "",
};

function toFormValues(row: AdsCostRow): AdsCostFormValues {
  return {
    periodStart: row.periodStart.slice(0, 10),
    periodEnd: row.periodEnd.slice(0, 10),
    adId: row.adId,
    adName: row.adName,
    sourceName: row.sourceName ?? "none",
    fanpageName: row.fanpageName ?? "none",
    branchCode: row.branchCode ?? "none",
    costVnd: row.costVnd,
    note: row.note ?? "",
  };
}

export function AdsCostDialog({
  mode,
  row,
  sourceOptions,
  fanpageOptions,
  branchOptions,
}: {
  mode: "create" | "edit";
  row?: AdsCostRow;
  sourceOptions: string[];
  fanpageOptions: string[];
  branchOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AdsCostFormValues>(row ? toFormValues(row) : EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof AdsCostFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setForm(row ? toFormValues(row) : EMPTY);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = { ...form, note: form.note || undefined };
      if (mode === "create") {
        await createAdsCost(payload);
      } else if (row) {
        await updateAdsCost(row.id, payload);
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
            <Button className="glossy shadow-bubble h-10 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90" />
          ) : (
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Sửa chi phí" />
          )
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="size-4" /> Thêm chi phí
          </>
        ) : (
          <Pencil className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent className="shadow-bubble max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-primary/15 bg-card/98 p-6 backdrop-blur-xl sm:max-w-2xl sm:p-8 lg:max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <DialogHeader className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-0.5 pr-8">
            <span className="glossy row-span-2 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Megaphone className="size-5" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-primary uppercase">Marketing</p>
            <DialogTitle className="text-xl">
              {mode === "create" ? "Thêm chi phí quảng cáo" : `Sửa chi phí: ${row?.adId}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="ads-period-start" className="text-base">Bắt đầu kỳ</Label>
              <Input
                id="ads-period-start"
                type="date"
                value={form.periodStart}
                onChange={(e) => update("periodStart", e.target.value)}
                required
                className="h-12 rounded-xl bg-secondary/40 text-base"
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="ads-period-end" className="text-base">Kết thúc kỳ</Label>
              <Input
                id="ads-period-end"
                type="date"
                value={form.periodEnd}
                onChange={(e) => update("periodEnd", e.target.value)}
                required
                className="h-12 rounded-xl bg-secondary/40 text-base"
              />
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="ads-ad-id" className="text-base">Ad ID</Label>
              <Input id="ads-ad-id" value={form.adId} onChange={(e) => update("adId", e.target.value)} required className="h-12 rounded-xl bg-secondary/40 text-base" />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="ads-ad-name" className="text-base">Tên quảng cáo</Label>
              <Input id="ads-ad-name" value={form.adName} onChange={(e) => update("adName", e.target.value)} required className="h-12 rounded-xl bg-secondary/40 text-base" />
            </div>
          </div>

          <div className="h-px bg-border/60" />

          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-3">
            <div className="flex flex-col gap-2.5">
              <Label className="text-base">Nguồn</Label>
              <Select value={form.sourceName} onValueChange={(v) => update("sourceName", v ?? "none")}>
                <SelectTrigger className="h-12 w-full rounded-xl bg-background text-base">
                  <SelectValue placeholder="Chọn nguồn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không chọn</SelectItem>
                  {sourceOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2.5">
              <Label className="text-base">Fanpage</Label>
              <Select value={form.fanpageName} onValueChange={(v) => update("fanpageName", v ?? "none")}>
                <SelectTrigger className="h-12 w-full rounded-xl bg-background text-base">
                  <SelectValue placeholder="Chọn fanpage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không chọn</SelectItem>
                  {fanpageOptions.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2.5">
              <Label className="text-base">Cơ sở</Label>
              <Select value={form.branchCode} onValueChange={(v) => update("branchCode", v ?? "none")}>
                <SelectTrigger className="h-12 w-full rounded-xl bg-background text-base">
                  <SelectValue placeholder="Chọn cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không chọn</SelectItem>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="ads-cost" className="text-base">Chi phí (VND)</Label>
              <Input
                id="ads-cost"
                type="number"
                min={0}
                step="1000"
                value={form.costVnd}
                onChange={(e) => update("costVnd", e.target.value)}
                required
                className="h-12 rounded-xl bg-secondary/40 text-base"
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="ads-note" className="text-base">Ghi chú (tuỳ chọn)</Label>
              <Input id="ads-note" value={form.note} onChange={(e) => update("note", e.target.value)} className="h-12 rounded-xl bg-secondary/40 text-base" />
            </div>
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="h-11 rounded-full border-border bg-secondary/60 px-6 text-base text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble h-11 rounded-full bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {mode === "create" ? "Tạo chi phí" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
