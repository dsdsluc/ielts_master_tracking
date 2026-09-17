"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DuplicateConflict } from "@/app/(app)/leads/types";

/** Kết quả của 1 lần lưu — `ok:false` nghĩa là server nghi trùng (409), Sale
 * cần xác nhận "vẫn lưu" trước khi gọi lại onSave với duplicateReason. */
export type EditFieldSaveResult =
  | { ok: true }
  | { ok: false; duplicate: DuplicateConflict["duplicate"] };

/** Dialog nhỏ dùng chung để sửa ĐÚNG 1 trường trong "Thông tin liên hệ" — các
 * input ngoài form chính luôn ở trạng thái khóa (disabled), CHỈ đổi được giá
 * trị qua dialog này rồi bấm Lưu — đúng lúc đó server mới thật sự ghi đè +
 * ghi log thay đổi (xem updateInteractionInfo trong mutations.ts). Dialog
 * không tự biết field nào đang sửa mang ý nghĩa gì trong payload — cha
 * (lead-workspace.tsx) truyền label/currentValue/kind/selectOptions phù hợp
 * và tự dựng payload đầy đủ khi gọi onSave. */
export function EditFieldDialog({
  open,
  onOpenChange,
  label,
  currentValue,
  kind,
  selectOptions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  currentValue: string;
  kind: "text" | "select";
  selectOptions?: { value: string; label: string }[];
  onSave: (newValue: string, duplicateReason?: string) => Promise<EditFieldSaveResult>;
}) {
  const [value, setValue] = useState(currentValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateConflict["duplicate"] | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(currentValue);
      setError(null);
      setDuplicate(null);
    }
  }, [open, currentValue]);

  async function submit(duplicateReason?: string) {
    setPending(true);
    setError(null);
    try {
      const result = await onSave(value, duplicateReason);
      if (!result.ok) {
        setDuplicate(result.duplicate);
        return;
      }
      setDuplicate(null);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không lưu được thay đổi.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  const selectItems = Object.fromEntries((selectOptions ?? []).map((o) => [o.value, o.label]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-bubble overflow-hidden rounded-2xl border border-border bg-card/98 p-5 backdrop-blur-xl sm:max-w-xl sm:p-7">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="text-lg">Sửa {label}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-field-value">{label}</Label>
            {kind === "text" ? (
              <Input
                id="edit-field-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-10 rounded-lg text-sm"
                autoFocus
              />
            ) : (
              <Select value={value} onValueChange={(v) => setValue(v ?? "")} items={selectItems}>
                <SelectTrigger id="edit-field-value" className="h-10 w-full rounded-lg text-sm">
                  <SelectValue placeholder={`Chọn ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {(selectOptions ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {duplicate && (
            <Alert variant="destructive">
              <AlertDescription>
                Nghi trùng với liên hệ <strong className="text-foreground">{duplicate.customerName}</strong> tạo lúc{" "}
                {new Date(duplicate.createdLeadAt).toLocaleString("vi-VN")}
                {duplicate.assignedSaleName ? ` (${duplicate.assignedSaleName})` : ""}. Vẫn muốn lưu?
              </AlertDescription>
            </Alert>
          )}
          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            {duplicate ? (
              <Button
                type="button"
                variant="outline"
                className="glossy rounded-full border-gold/40 bg-accent px-5 text-accent-foreground hover:bg-accent/80"
                disabled={pending}
                onClick={() => submit("Sale xác nhận không trùng, vẫn lưu thay đổi")}
              >
                {pending && <LoaderCircle className="animate-spin" />}
                Vẫn lưu thay đổi
              </Button>
            ) : (
              <Button
                type="submit"
                className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                disabled={pending}
              >
                {pending && <LoaderCircle className="animate-spin" />}
                Lưu thay đổi
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
