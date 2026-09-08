"use client";

import { useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { FormMessage } from "@/components/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateStatus } from "@/app/(app)/leads/leads-api";
import { SILENCE_REASON_CODE, SPAM_REASON_OPTIONS } from "@/app/(app)/leads/types";
import { useToast } from "@/hooks/use-toast";

export function SpamDialog({
  open,
  onOpenChange,
  interactionId,
  expectedVersion,
  touchCount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interactionId: string;
  expectedVersion: number;
  touchCount: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSilence = reason === SILENCE_REASON_CODE;
  const notEnoughTouches = isSilence && touchCount < 3;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setError(null);
    setPending(true);
    try {
      await updateStatus(interactionId, {
        status: "Spam",
        spamReason: reason,
        confirmedMinAttempts: isSilence ? true : undefined,
        expectedVersion,
      });
      setReason("");
      onOpenChange(false);
      toast.success("Đã đóng Spam.");
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không cập nhật được.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-destructive/20 bg-card/98 p-5 backdrop-blur-xl sm:max-w-xl sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pr-8">
            <span className="glossy row-span-3 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-destructive uppercase">
              Đóng liên hệ — không thành công
            </p>
            <DialogTitle className="text-lg">Đánh dấu Spam</DialogTitle>
            <DialogDescription>Chọn lý do — bắt buộc, sẽ được ghi vào nhật ký hệ thống.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <Label htmlFor="spam-reason">Lý do đóng</Label>
            <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
              <SelectTrigger id="spam-reason" className="h-11 w-full rounded-xl bg-background">
                <SelectValue placeholder="Chọn lý do…" />
              </SelectTrigger>
              <SelectContent>
                {SPAM_REASON_OPTIONS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSilence && (
            <Alert variant={notEnoughTouches ? "destructive" : "default"} className="mt-1">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                {notEnoughTouches
                  ? `Liên hệ này mới ghi nhận ${touchCount} lần chăm sóc. Lý do "khách im lặng" cần ít nhất 3 lần ở 3 thời điểm khác nhau — hệ thống sẽ từ chối nếu chưa đủ.`
                  : `Liên hệ đã có ${touchCount} lần chăm sóc được ghi nhận — hệ thống sẽ tự kiểm tra có đủ 3 thời điểm khác nhau không.`}
              </AlertDescription>
            </Alert>
          )}

          {error && <FormMessage kind="error" className="mt-2">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" variant="destructive" className="glossy shadow-bubble rounded-full bg-destructive px-5 text-white hover:bg-destructive/90" disabled={pending || !reason}>
              {pending && <LoaderCircle className="animate-spin" />}
              Xác nhận đóng Spam
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
