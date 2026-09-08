"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { updateStatusMeta } from "@/app/(app)/admin/statuses/actions";

export function StatusDialog({ status }: { status: { name: string; sortOrder: number; note: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState(String(status.sortOrder));
  const [note, setNote] = useState(status.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await updateStatusMeta(status.name, { sortOrder, note: note || undefined });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Sửa trạng thái ${status.name}`} />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Sửa trạng thái: {status.name}</DialogTitle>
            <DialogDescription>Tên trạng thái cố định theo quy trình hệ thống — chỉ chỉnh thứ tự hiển thị và ghi chú.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-sort">Thứ tự hiển thị</Label>
            <Input id="status-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} required className="h-10 rounded-xl" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-note">Ghi chú (tuỳ chọn)</Label>
            <Input id="status-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-10 rounded-xl" />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
