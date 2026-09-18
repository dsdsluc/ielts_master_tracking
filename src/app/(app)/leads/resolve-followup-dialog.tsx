"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";

export function ResolveFollowupDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote("");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setError(null);
    setPending(true);
    try {
      await onConfirm(note.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card/98 p-5 backdrop-blur-xl sm:max-w-md sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pr-8">
            <span className="glossy row-span-3 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-5 text-gold" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-gold uppercase">Chăm sóc lại</p>
            <DialogTitle className="text-lg">Đánh dấu đã chăm sóc lại</DialogTitle>
            <DialogDescription>
              Ghi lại đã chăm sóc như thế nào — liên hệ sẽ chuyển sang trạng thái Có nhu cầu và nội dung này lưu vào Lịch sử chăm sóc.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolve-followup-note">Đã chăm sóc như thế nào</Label>
            <Textarea
              id="resolve-followup-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vd: Đã gọi lại, khách xác nhận vẫn quan tâm, hẹn tư vấn lại tuần sau..."
              className="min-h-24 rounded-xl"
              autoFocus
            />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" disabled={pending || !note.trim()}>
              {pending && <LoaderCircle className="animate-spin" />}
              Xác nhận đã chăm sóc lại
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
