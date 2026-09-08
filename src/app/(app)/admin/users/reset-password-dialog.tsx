"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, KeyRound, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormMessage } from "@/components/form-message";
import { resetUserPassword } from "@/app/(app)/admin/users/actions";

export function ResetPasswordDialog({ email, fullName }: { email: string; fullName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("12345678");
  const [mustChange, setMustChange] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPassword("12345678");
    setMustChange(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await resetUserPassword(email, password, mustChange);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đặt lại được mật khẩu.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Đặt lại mật khẩu cho ${fullName}`} />}>
        <KeyRound className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Đặt mật khẩu mới cho {fullName}</DialogTitle>
            <DialogDescription>Đặt trực tiếp mật khẩu mới — không thể xem lại mật khẩu cũ.</DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>Mật khẩu được lưu dưới dạng mã băm (hash) một chiều nên hệ thống không thể hiển thị lại mật khẩu cũ — chỉ có thể đặt mật khẩu mới.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset-password">Mật khẩu mới</Label>
            <Input
              id="reset-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-10 rounded-xl font-mono"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Bắt buộc đổi ở lần đăng nhập tới</span>
              <span className="text-xs text-muted-foreground">Tắt nếu muốn dùng thẳng mật khẩu này lâu dài</span>
            </div>
            <Switch checked={mustChange} onCheckedChange={setMustChange} />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              Đặt mật khẩu mới
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
