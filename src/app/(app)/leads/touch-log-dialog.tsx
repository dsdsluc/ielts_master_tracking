"use client";

import { useState } from "react";
import { LoaderCircle, MessageSquarePlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

/** Nút "Ghi nhận đã liên hệ" — mở dialog nhỏ cho phép kèm ghi chú (tuỳ chọn)
 * thay vì gửi thẳng 1 dòng trống, để lịch sử chăm sóc còn tra cứu lại được. */
export function TouchLogDialog({
  onSubmit,
  pending,
  className,
}: {
  onSubmit: (note?: string) => Promise<boolean | void>;
  pending: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await onSubmit(note.trim() || undefined);
    if (ok !== false) {
      setOpen(false);
      setNote("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNote("");
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={className ?? "rounded-full border-status-received/25 bg-status-received-bg/50 text-status-received hover:bg-status-received-bg"}
          />
        }
      >
        <MessageSquarePlus className="size-3.5" />
        Ghi nhận đã liên hệ
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Ghi nhận đã liên hệ</DialogTitle>
            <DialogDescription>Ghi chú giúp bạn và đồng nghiệp nhớ lại đã trao đổi gì — có thể để trống.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="touch-note">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="touch-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Đã gọi, khách hẹn gọi lại chiều nay"
              rows={3}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-status-received text-white hover:bg-status-received/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Ghi nhận
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
