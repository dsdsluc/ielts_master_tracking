"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createObject, updateObject } from "@/app/(app)/admin/objects/actions";

export function ObjectDialog({
  mode,
  object,
}: {
  mode: "create" | "edit";
  object?: { name: string; sortOrder: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(object?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(object?.sortOrder ?? 0));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    if (!object) {
      setName("");
      setSortOrder("0");
    }
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "create") {
        await createObject({ name, sortOrder });
      } else if (object) {
        await updateObject(object.name, { sortOrder });
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
            <Button className="rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90" />
          ) : (
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Sửa đối tượng" />
          )
        }
      >
        {mode === "create" ? (
          <>
            <Plus className="size-4" /> Thêm đối tượng mới
          </>
        ) : (
          <Pencil className="size-3.5" />
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Thêm đối tượng mới" : `Sửa đối tượng: ${object?.name}`}</DialogTitle>
          </DialogHeader>

          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="object-name">Tên đối tượng</Label>
              <Input id="object-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Phụ huynh" required className="h-10 rounded-xl" />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="object-sort">Thứ tự hiển thị</Label>
            <Input id="object-sort" type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} required className="h-10 rounded-xl" />
          </div>

          {error && <FormMessage kind="error">{error}</FormMessage>}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {mode === "create" ? "Tạo đối tượng" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
