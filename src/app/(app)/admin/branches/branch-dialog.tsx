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
import { FormMessage } from "@/components/form-message";
import { createBranch, updateBranch } from "@/app/(app)/admin/branches/actions";

type BranchFormValues = {
  name: string;
  slaReceiveMinutes: string;
  slaProcessHours: string;
  note: string;
};

const EMPTY: BranchFormValues = { name: "", slaReceiveMinutes: "30", slaProcessHours: "24", note: "" };

export function BranchDialog({
  mode,
  branch,
}: {
  mode: "create" | "edit";
  branch?: { code: string; name: string; slaReceiveMinutes: number; slaProcessHours: number; note: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(branch?.code ?? "");
  const [form, setForm] = useState<BranchFormValues>(
    branch
      ? { name: branch.name, slaReceiveMinutes: String(branch.slaReceiveMinutes), slaProcessHours: String(branch.slaProcessHours), note: branch.note ?? "" }
      : EMPTY
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BranchFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    if (!branch) {
      setCode("");
      setForm(EMPTY);
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        slaReceiveMinutes: form.slaReceiveMinutes,
        slaProcessHours: form.slaProcessHours,
        note: form.note || undefined,
      };
      if (mode === "create") {
        await createBranch({ code, ...payload });
      } else if (branch) {
        await updateBranch(branch.code, payload);
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
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Sửa cơ sở" />
          )
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="size-4" /> Thêm cơ sở mới
          </>
        ) : (
          <Pencil className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Thêm cơ sở mới" : `Sửa cơ sở: ${branch?.name}`}</DialogTitle>
          </DialogHeader>

          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-code">Mã cơ sở</Label>
              <Input id="branch-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TDM" required className="h-10 rounded-xl" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-name">Tên cơ sở</Label>
            <Input id="branch-name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Thủ Dầu Một" required className="h-10 rounded-xl" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-sla-receive">SLA nhận (phút)</Label>
              <Input
                id="branch-sla-receive"
                type="number"
                min={1}
                value={form.slaReceiveMinutes}
                onChange={(e) => update("slaReceiveMinutes", e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-sla-process">SLA xử lý (giờ)</Label>
              <Input
                id="branch-sla-process"
                type="number"
                min={1}
                value={form.slaProcessHours}
                onChange={(e) => update("slaProcessHours", e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-note">Ghi chú (tuỳ chọn)</Label>
            <Input id="branch-note" value={form.note} onChange={(e) => update("note", e.target.value)} className="h-10 rounded-xl" />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {mode === "create" ? "Tạo cơ sở" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
