"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function shiftDate(dateStr: string, deltaDays: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PageReportDatePicker({ date }: { date: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goTo(nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", nextDate);
    router.push(`/page-report?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => goTo(shiftDate(date, -1))} aria-label="Ngày trước">
        <ChevronLeft className="size-4" />
      </Button>
      <Input type="date" value={date} onChange={(e) => e.target.value && goTo(e.target.value)} className="h-10 w-40 rounded-xl bg-background text-sm" />
      <Button variant="outline" size="icon-sm" className="rounded-full" onClick={() => goTo(shiftDate(date, 1))} aria-label="Ngày sau">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
