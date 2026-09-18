"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftMonth } from "@/app/(app)/admin/monthly-report/month-utils";

/** Điều hướng tháng dùng chung cho mọi trang chi tiết (/admin/monthly-report/*)
 * — luôn kèm nút quay lại Tổng quan đúng tháng đang xem, để không bị lạc
 * ngữ cảnh khi đào sâu từng phần. */
export function DetailMonthNav({ month, basePath }: { month: string; basePath: string }) {
  const router = useRouter();

  function goTo(nextMonth: string) {
    router.push(`${basePath}?month=${nextMonth}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-10 rounded-full" nativeButton={false} render={<Link href={`/admin/monthly-report?month=${month}`} />}>
        <ArrowLeft className="size-3.5" /> Tổng quan
      </Button>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => goTo(shiftMonth(month, -1))} aria-label="Tháng trước">
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="month"
          value={month}
          onChange={(e) => e.target.value && goTo(e.target.value)}
          className="h-10 w-40 rounded-xl bg-background text-sm"
        />
        <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => goTo(shiftMonth(month, 1))} aria-label="Tháng sau">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
