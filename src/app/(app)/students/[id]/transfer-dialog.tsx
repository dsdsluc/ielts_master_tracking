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
import { apiErrorMessage } from "@/lib/api-client";
import { fetchTransferTargets, transferStudent } from "@/app/(app)/students/actions";
import { useToast } from "@/hooks/use-toast";

type TransferTarget = { email: string; fullName: string };

export function TransferDialog({
  open,
  onOpenChange,
  studentProfileId,
  currentAssignedEmail,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentProfileId: string;
  currentAssignedEmail: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [targets, setTargets] = useState<TransferTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Fetch-on-open: mirror leads/reassign-dialog.tsx — không có store để
    // subscribe cho 1 Server Action đơn thuần.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetEmail("");
    setReason("");
    setError(null);
    setLoadingTargets(true);
    fetchTransferTargets()
      .then(setTargets)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingTargets(false));
  }, [open]);

  const options = targets.filter((t) => t.email !== currentAssignedEmail);
  const targetItems = Object.fromEntries(options.map((t) => [t.email, t.fullName]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmail || !reason.trim()) return;
    setError(null);
    setPending(true);
    try {
      await transferStudent(studentProfileId, targetEmail, reason.trim());
      onOpenChange(false);
      toast.success("Đã chuyển giao học viên.");
      onDone();
    } catch (err) {
      const message = apiErrorMessage(err);
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
              Chuyển giao học viên
            </p>
            <DialogTitle className="text-lg">Chuyển cho tư vấn viên khác</DialogTitle>
            <DialogDescription>Dùng khi Sale hiện tại không hiệu quả, quá tải hoặc nghỉ việc — lý do sẽ được lưu vào nhật ký chăm sóc của học viên.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-secondary/30 p-4">
            <Label htmlFor="transfer-target">Tư vấn viên mới</Label>
            <Select value={targetEmail} onValueChange={(v) => setTargetEmail(v ?? "")} items={targetItems} disabled={loadingTargets}>
              <SelectTrigger id="transfer-target" className="h-11 w-full rounded-xl bg-background">
                <SelectValue placeholder={loadingTargets ? "Đang tải…" : "Chọn tư vấn viên…"} />
              </SelectTrigger>
              <SelectContent>
                {options.map((t) => (
                  <SelectItem key={t.email} value={t.email}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-reason">Lý do chuyển giao</Label>
            <Textarea
              id="transfer-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vd: Sale hiện tại không hiệu quả, đã quá 5 ngày chưa liên hệ lại..."
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
              Xác nhận chuyển giao
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
