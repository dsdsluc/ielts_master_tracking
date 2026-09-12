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
import { fetchAssignableSales, reassignInteractionsBulk, type AssignableSale } from "@/app/(app)/leads/leads-api";
import { useToast } from "@/hooks/use-toast";

export function BulkReassignDialog({
  open,
  onOpenChange,
  items,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: { interactionId: string; expectedVersion: number }[];
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
    // Fetch-on-open: mirror reassign-dialog.tsx (không có store để subscribe
    // cho 1 lệnh REST đơn thuần).
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

  const salesItems = Object.fromEntries(sales.map((s) => [s.email, s.fullName]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmail || !reason.trim() || items.length === 0) return;
    setError(null);
    setPending(true);
    try {
      const result = await reassignInteractionsBulk({ items, targetEmail, reason: reason.trim() });
      onOpenChange(false);
      if (result.skipped.length > 0) {
        toast.error(`Đã điều chuyển ${result.reassigned.length}/${items.length} liên hệ — ${result.skipped.length} liên hệ bị bỏ qua (đã đổi trạng thái/được xử lý bởi người khác).`);
      } else {
        toast.success(`Đã điều chuyển ${result.reassigned.length} liên hệ.`);
      }
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
              Điều chuyển hàng loạt
            </p>
            <DialogTitle className="text-lg">Chuyển {items.length} liên hệ cho tư vấn viên khác</DialogTitle>
            <DialogDescription>Áp dụng cho toàn bộ liên hệ đã chọn — lý do sẽ được ghi vào nhật ký hệ thống cho từng liên hệ.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <Label htmlFor="bulk-reassign-target">Tư vấn viên mới</Label>
            <Select value={targetEmail} onValueChange={(v) => setTargetEmail(v ?? "")} items={salesItems} disabled={loadingSales}>
              <SelectTrigger id="bulk-reassign-target" className="h-11 w-full rounded-xl bg-background">
                <SelectValue placeholder={loadingSales ? "Đang tải…" : "Chọn tư vấn viên…"} />
              </SelectTrigger>
              <SelectContent>
                {sales.map((s) => (
                  <SelectItem key={s.email} value={s.email}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-reassign-reason">Lý do điều chuyển</Label>
            <Textarea
              id="bulk-reassign-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vd: Sale A nghỉ việc, chuyển toàn bộ liên hệ đang phụ trách cho Sale B..."
              className="min-h-20 rounded-xl"
            />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" disabled={pending || !targetEmail || !reason.trim() || items.length === 0}>
              {pending && <LoaderCircle className="animate-spin" />}
              Xác nhận điều chuyển ({items.length})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
