"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FileDown, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftMonth } from "@/app/(app)/admin/monthly-report/month-utils";

export function MonthlyReportControls({ month }: { month: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    router.push(`/admin/monthly-report?${params.toString()}`);
  }

  const exportHref = `/api/admin/monthly-report/export?month=${month}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => navigate(shiftMonth(month, -1))} aria-label="Tháng trước">
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="month"
          value={month}
          onChange={(e) => e.target.value && navigate(e.target.value)}
          className="h-10 w-40 rounded-xl bg-background text-sm"
        />
        <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => navigate(shiftMonth(month, 1))} aria-label="Tháng sau">
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <Button variant="outline" size="sm" className="h-10 rounded-full" nativeButton={false} render={<Link href={`/admin/monthly-report/compare?months=${month}`} />}>
        <GitCompareArrows className="size-3.5" /> So sánh nhiều tháng
      </Button>
      <Button variant="outline" size="sm" className="h-10 rounded-full" nativeButton={false} render={<a href={exportHref} />}>
        <FileDown className="size-3.5" /> Xuất Excel
      </Button>
    </div>
  );
}
