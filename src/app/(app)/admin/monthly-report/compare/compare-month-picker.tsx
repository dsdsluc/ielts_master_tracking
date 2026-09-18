"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";

const MAX_MONTHS = 6;
const MIN_MONTHS = 2;

/** Chọn tự do 2-6 tháng bất kỳ để so sánh cạnh nhau — khác bộ so sánh nhúng
 * trong trang tổng quan (luôn cố định 1 "tháng đang xem" làm gốc), ở đây
 * không có tháng nào là "chính", tất cả ngang hàng nhau. */
export function CompareMonthPicker({ months }: { months: string[] }) {
  const router = useRouter();
  const [addValue, setAddValue] = useState("");

  function navigate(next: string[]) {
    const sorted = [...new Set(next)].sort();
    router.push(`/admin/monthly-report/compare?months=${sorted.join(",")}`);
  }

  function addMonth(value: string) {
    if (!value || months.includes(value) || months.length >= MAX_MONTHS) return;
    navigate([...months, value]);
    setAddValue("");
  }

  function removeMonth(value: string) {
    if (months.length <= MIN_MONTHS) return;
    navigate(months.filter((m) => m !== value));
  }

  const exportHref = `/api/admin/monthly-report/export?month=${months[0]}${months.length > 1 ? `&compare=${months.slice(1).join(",")}` : ""}`;

  return (
    <div className="flex flex-col items-end gap-2.5">
      <Button variant="outline" size="sm" className="h-10 rounded-full" nativeButton={false} render={<a href={exportHref} />}>
        <FileDown className="size-3.5" /> Xuất Excel
      </Button>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {months.map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground">
            {monthLabel(m)}
            {months.length > MIN_MONTHS && (
              <button type="button" onClick={() => removeMonth(m)} aria-label={`Bỏ tháng ${m}`} className="text-muted-foreground hover:text-destructive">
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {months.length < MAX_MONTHS && (
          <div className="flex items-center gap-1">
            <Input type="month" value={addValue} onChange={(e) => setAddValue(e.target.value)} className="h-9 w-36 rounded-lg bg-background text-xs" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:text-foreground"
              disabled={!addValue}
              onClick={() => addMonth(addValue)}
              aria-label="Thêm tháng"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
