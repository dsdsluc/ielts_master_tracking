"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, UserCog } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";
import { fetchAssignableSales, reassignInteraction, type AssignableSale } from "@/app/(app)/leads/leads-api";
import { useToast } from "@/hooks/use-toast";

export function ReassignDialog({
  open,
  onOpenChange,
  interactionId,
  expectedVersion,
  currentAssignedEmail,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interactionId: string;
  expectedVersion: number;
  currentAssignedEmail: string | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [sales, setSales] = useState<AssignableSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Fetch-on-open: no external store to subscribe to for a REST call, so
    // resetting form state + kicking off the fetch here is the standard shape
    // (mirror leads-queue-view.tsx's fetch-on-tab-change effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetEmail("");
    setReason("");
    setError(null);
    setLoadingSales(true);
    fetchAssignableSales()
      .then(setSales)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh sách tư vấn viên."))
      .finally(() => setLoadingSales(false));
  }, [open]);

  const options = sales.filter((s) => s.email !== currentAssignedEmail);
  const salesItems = Object.fromEntries(options.map((s) => [s.email, s.fullName]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmail || !reason.trim()) return;
    setError(null);
    setPending(true);
    try {
      await reassignInteraction(interactionId, { targetEmail, reason: reason.trim(), expectedVersion });
      onOpenChange(false);
      toast.success("Đã điều chuyển người phụ trách.");
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không điều chuyển được.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card/98 p-5 backdrop-blur-xl sm:max-w-xl sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pr-8">
            <span className="glossy row-span-3 flex size-11 items-center justify-center rounded-full bg-status-received-bg text-status-received">
              <UserCog className="size-5" />
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-status-received uppercase">
              Điều chuyển người phụ trách
            </p>
            <DialogTitle className="text-lg">Chuyển cho tư vấn viên khác</DialogTitle>
            <DialogDescription>Dùng khi Sale hiện tại quá tải hoặc nghỉ việc — lý do sẽ được ghi vào nhật ký hệ thống.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <Label htmlFor="reassign-target">Tư vấn viên mới</Label>
            <Select value={targetEmail} onValueChange={(v) => setTargetEmail(v ?? "")} items={salesItems} disabled={loadingSales}>
              <SelectTrigger id="reassign-target" className="h-11 w-full rounded-xl bg-background">
                <SelectValue placeholder={loadingSales ? "Đang tải…" : "Chọn tư vấn viên…"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((s) => (
                  <SelectItem key={s.email} value={s.email}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reassign-reason">Lý do điều chuyển</Label>
            <Textarea
              id="reassign-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vd: Sale A đang quá tải, chuyển bớt cho Sale B..."
              className="min-h-20 rounded-xl"
            />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" disabled={pending || !targetEmail || !reason.trim()}>
              {pending && <LoaderCircle className="animate-spin" />}
              Xác nhận điều chuyển
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
