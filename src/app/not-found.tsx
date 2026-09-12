import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4 py-10">
      <div className="shadow-bubble flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-border/70 bg-card px-8 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-6" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-lg font-semibold text-foreground">Không tìm thấy trang</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Trang bạn vừa mở không tồn tại, hoặc đường dẫn đã thay đổi. Hãy quay lại trang chủ để tiếp tục.
          </p>
        </div>
        <Button type="button" nativeButton={false} className="glossy shadow-bubble mt-2 rounded-full px-5" render={<Link href="/" />}>
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}
