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

export function RestoreSpamDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
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
    setError(null);
    setPending(true);
    try {
      await onConfirm(note.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không khôi phục được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card/98 p-5 backdrop-blur-xl sm:max-w-xl sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pr-8">
            <span className="glossy row-span-3 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-5 text-gold" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-gold uppercase">Quản trị</p>
            <DialogTitle className="text-lg">Khôi phục về Tiếp nhận ({selectedCount})</DialogTitle>
            <DialogDescription>
              Liên hệ sẽ chuyển về &quot;Tiếp nhận&quot; và vào ngay hàng đợi &quot;Cần chăm sóc lại&quot; — Leader sẽ phân bổ Sale phụ trách sau, giống hệt khi Marketing gửi yêu cầu.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spam-restore-note">Ghi chú cho Leader (tuỳ chọn)</Label>
            <Textarea
              id="spam-restore-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vd: xem lại thấy khách vẫn có nhu cầu, không phải Spam..."
              className="min-h-20 rounded-xl"
            />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Khôi phục ({selectedCount})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
