"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { deleteAdsCost } from "@/app/(app)/ads-cost/actions";

export function DeleteAdsCostDialog({ id, adId }: { id: number; adId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteAdsCost(id);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Xoá chi phí" />}
      >
        <Trash2 className="size-3.5" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá chi phí quảng cáo?</AlertDialogTitle>
          <AlertDialogDescription>
            Bản ghi chi phí cho Ad ID <strong className="font-mono text-foreground">{adId}</strong> sẽ bị xoá vĩnh viễn, không thể khôi phục.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <FormMessage kind="error">{error}</FormMessage>}

        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" className="rounded-full" disabled={pending} />}>
            Huỷ
          </AlertDialogClose>
          <Button
            type="button"
            className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending && <LoaderCircle className="animate-spin" />}
            Xoá
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
