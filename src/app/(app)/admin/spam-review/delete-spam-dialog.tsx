"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/form-message";

export function DeleteSpamDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReason("");
    setError(null);
  }, [open]);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá vĩnh viễn {selectedCount} liên hệ Spam?</AlertDialogTitle>
          <AlertDialogDescription>
            Dữ liệu liên hệ (kèm lịch sử chăm sóc) sẽ bị xoá hẳn khỏi hệ thống, không thể khôi phục. Chỉ dùng cho liên hệ rác/ảo — nếu còn nghi ngờ, hãy chọn &quot;Khôi phục về Chăm sóc lại&quot; thay vì xoá.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spam-delete-reason" className="text-xs text-muted-foreground">
            Lý do xoá (tuỳ chọn)
          </Label>
          <Textarea
            id="spam-delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vd: tài khoản ảo, số điện thoại giả..."
            className="min-h-16 rounded-xl"
          />
        </div>

        {error && <FormMessage kind="error">{error}</FormMessage>}

        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" className="rounded-full" disabled={pending} />}>
            Huỷ
          </AlertDialogClose>
          <Button
            type="button"
            className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Xoá vĩnh viễn ({selectedCount})
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
