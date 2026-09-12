"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Bắt mọi lỗi render/runtime chưa xử lý trong (app) và (auth) — không có file
// này thì Next.js sẽ tự hiển thị trang lỗi mặc định (tiếng Anh, không có lối
// thoát rõ ràng) khi 1 component bất ngờ crash.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-10">
      <div className="shadow-bubble flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-border/70 bg-card px-8 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-6" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-lg font-semibold text-foreground">Đã có lỗi xảy ra</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Có gì đó không đúng khi tải trang này. Bạn có thể thử lại — nếu vẫn lỗi, hãy báo cho quản trị hệ thống
            kèm theo mã bên dưới (nếu có).
          </p>
        </div>
        {error.digest && (
          <p className="rounded-full bg-secondary px-3 py-1 font-mono text-[11px] text-muted-foreground">
            Mã lỗi: {error.digest}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" onClick={reset} className="glossy shadow-bubble rounded-full px-5">
            <RotateCw className="size-4" />
            Thử lại
          </Button>
          <Button
            type="button"
            variant="outline"
            nativeButton={false}
            className="rounded-full px-5"
            render={<Link href="/" />}
          >
            Về trang chủ
          </Button>
        </div>
      </div>
    </div>
  );
}
