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
import { fetchAssignableSales, type AssignableSale } from "@/app/(app)/leads/leads-api";

export function PushFollowupDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (targetSaleEmail: string, suggestion: string) => Promise<void>;
}) {
  const [sales, setSales] = useState<AssignableSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [targetSaleEmail, setTargetSaleEmail] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Fetch-on-open: mirror leads/reassign-dialog.tsx — không có store để
    // subscribe cho 1 lệnh REST đơn thuần.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetSaleEmail("");
    setSuggestion("");
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
    if (!targetSaleEmail) return;
    setError(null);
    setPending(true);
    try {
      await onConfirm(targetSaleEmail, suggestion.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu.");
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
            <p className="font-condensed text-[10px] tracking-[0.2em] text-gold uppercase">Chăm sóc lại</p>
            <DialogTitle className="text-lg">Chọn Sale nhận yêu cầu ({selectedCount})</DialogTitle>
            <DialogDescription>Sale được chọn sẽ thấy các liên hệ này ở trang &quot;Cần chăm sóc lại&quot; của họ.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <Label htmlFor="followup-target-sale">Sale phụ trách chăm sóc lại</Label>
            <Select value={targetSaleEmail} onValueChange={(v) => setTargetSaleEmail(v ?? "")} items={salesItems} disabled={loadingSales}>
              <SelectTrigger id="followup-target-sale" className="h-11 w-full rounded-xl bg-background">
                <SelectValue placeholder={loadingSales ? "Đang tải…" : "Chọn Sale…"} />
              </SelectTrigger>
              <SelectContent>
                {sales.map((s) => (
                  <SelectItem key={s.email} value={s.email}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetSaleEmail && <p className="font-mono text-xs text-muted-foreground">{targetSaleEmail}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="followup-suggestion">Gợi ý gửi kèm cho Sale (tuỳ chọn)</Label>
            <Textarea
              id="followup-suggestion"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Vd: khách hỏi về học phí, gọi lại buổi chiều..."
              className="min-h-20 rounded-xl"
            />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" disabled={pending || !targetSaleEmail}>
              {pending && <LoaderCircle className="animate-spin" />}
              Gửi yêu cầu ({selectedCount})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
