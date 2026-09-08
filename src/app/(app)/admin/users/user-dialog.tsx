"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, UserRoundCog, UserRoundPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormMessage } from "@/components/form-message";
import { ROLES } from "@/lib/interactions/constants";
import { createUser, updateUser } from "@/app/(app)/admin/users/actions";

const ROLE_OPTIONS = Object.values(ROLES);

type UserFormValues = {
  email: string;
  fullName: string;
  role: string;
  branchCode: string;
  viewAllBranches: boolean;
  canCloseMktReport: boolean;
  note: string;
};

const EMPTY: UserFormValues = {
  email: "",
  fullName: "",
  role: ROLES.SALES,
  branchCode: "",
  viewAllBranches: false,
  canCloseMktReport: false,
  note: "",
};

export function UserDialog({
  mode,
  user,
  branchOptions,
}: {
  mode: "create" | "edit";
  user?: { email: string; fullName: string; role: string; branchCode: string | null; viewAllBranches: boolean; canCloseMktReport: boolean; note: string | null };
  branchOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [form, setForm] = useState<UserFormValues>(
    user
      ? {
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          branchCode: user.branchCode ?? "",
          viewAllBranches: user.viewAllBranches,
          canCloseMktReport: user.canCloseMktReport,
          note: user.note ?? "",
        }
      : EMPTY
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSales = form.role === ROLES.SALES;

  function update<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    if (!user) {
      setPassword("");
      setForm(EMPTY);
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = {
        email: form.email,
        fullName: form.fullName,
        role: form.role,
        branchCode: form.branchCode || undefined,
        viewAllBranches: form.viewAllBranches,
        canCloseMktReport: form.canCloseMktReport,
        note: form.note || undefined,
      };
      if (mode === "create") {
        await createUser({ ...payload, password: password || undefined });
      } else if (user) {
        await updateUser(user.email, payload);
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
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
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button className="glossy shadow-bubble rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90" />
          ) : (
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Sửa người dùng" />
          )
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="size-4" /> Thêm người dùng mới
          </>
        ) : (
          <Pencil className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent className="shadow-bubble max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-primary/15 bg-card/98 p-6 backdrop-blur-xl sm:max-w-2xl sm:p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
          <DialogHeader className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-0.5 pr-8">
            <span className="glossy row-span-2 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {mode === "create" ? <UserRoundPlus className="size-5" /> : <UserRoundCog className="size-5" />}
            </span>
            <p className="font-condensed text-[10px] tracking-[0.2em] text-primary uppercase">
              {mode === "create" ? "Người dùng mới" : "Chỉnh sửa"}
            </p>
            <DialogTitle className="text-xl">{mode === "create" ? "Thêm người dùng mới" : `Sửa: ${user?.fullName}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="ten@ieltsmaster.vn" required className="h-11 rounded-xl bg-secondary/40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name">Họ tên</Label>
              <Input id="user-name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required className="h-11 rounded-xl bg-secondary/40" />
            </div>
          </div>

          <div className="h-px bg-border/60" />

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Vai trò</Label>
              <Select value={form.role} onValueChange={(v) => update("role", v ?? ROLES.SALES)}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cơ sở phụ trách{isSales ? " (bắt buộc)" : " (tuỳ chọn)"}</Label>
              <Select value={form.branchCode} onValueChange={(v) => update("branchCode", v ?? "")}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                  <SelectValue placeholder="Chọn cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isSales && (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Xem tất cả cơ sở</span>
                  <span className="text-xs text-muted-foreground">Không giới hạn theo 1 cơ sở</span>
                </div>
                <Switch checked={form.viewAllBranches} onCheckedChange={(v) => update("viewAllBranches", v)} />
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Đóng báo cáo Marketing</span>
                <span className="text-xs text-muted-foreground">Quyền chốt báo cáo hàng kỳ</span>
              </div>
              <Switch checked={form.canCloseMktReport} onCheckedChange={(v) => update("canCloseMktReport", v)} />
            </div>
          </div>

          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-password">Mật khẩu ban đầu</Label>
              <Input id="user-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mặc định: 12345678" className="h-11 rounded-xl bg-secondary/40 font-mono" />
              <p className="text-xs text-muted-foreground">Để trống sẽ dùng mật khẩu mặc định 12345678. Bắt buộc đổi ở lần đăng nhập đầu.</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-note">Ghi chú (tuỳ chọn)</Label>
            <Input id="user-note" value={form.note} onChange={(e) => update("note", e.target.value)} className="h-11 rounded-xl bg-secondary/40" />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-full border-border bg-secondary/60 px-4 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {mode === "create" ? "Tạo người dùng" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
