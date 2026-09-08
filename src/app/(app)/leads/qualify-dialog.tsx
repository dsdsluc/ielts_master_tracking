"use client";

import { useState } from "react";
import { LoaderCircle, PhoneCall } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { updateStatus } from "@/app/(app)/leads/leads-api";
import { useToast } from "@/hooks/use-toast";

/** The "thành công" moment of the workflow — khách đồng ý để lại SĐT. Given
 * a glossy/shadow-bubble treatment (Fundas's convention for a positive
 * result screen), everything else in this UI stays plain. */
export function QualifyDialog({
  open,
  onOpenChange,
  interactionId,
  expectedVersion,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interactionId: string;
  expectedVersion: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await updateStatus(interactionId, { status: "Đủ tiêu chuẩn", phoneRaw: phone, expectedVersion });
      setPhone("");
      onOpenChange(false);
      toast.success("Đã đánh dấu Đủ tiêu chuẩn.");
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
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-status-qualified/20 bg-card/98 p-5 backdrop-blur-xl sm:max-w-xl sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pr-8">
            <span className="glossy row-span-3 flex size-11 items-center justify-center rounded-full bg-status-qualified-bg text-status-qualified">
              <PhoneCall className="size-5" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-status-qualified uppercase">
              Đóng liên hệ — thành công
            </p>
            <DialogTitle className="text-lg">Đánh dấu Đủ tiêu chuẩn</DialogTitle>
            <DialogDescription>
              Khách đã đồng ý để lại số điện thoại. Bạn sẽ được gán làm người phụ trách chính thức.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <Label htmlFor="qualify-phone">Số điện thoại khách</Label>
            <div className="relative">
              <PhoneCall className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="qualify-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xxxxxxxx"
                required
                className="h-11 rounded-xl bg-background pl-10 font-mono"
              />
            </div>
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-status-qualified px-5 text-white hover:bg-status-qualified/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Xác nhận đủ tiêu chuẩn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
