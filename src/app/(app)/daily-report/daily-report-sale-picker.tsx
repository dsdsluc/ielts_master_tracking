"use client";

import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ReportSaleOption = { email: string; fullName: string };

// Chỉ Leader/Admin thấy control này — Sale luôn chỉ xem đúng báo cáo của
// chính mình, không cần chọn (xem daily-report/page.tsx).
export function DailyReportSalePicker({ sales, selectedEmail }: { sales: ReportSaleOption[]; selectedEmail: string }) {
  const router = useRouter();
  const items = Object.fromEntries(sales.map((s) => [s.email, s.fullName]));

  return (
    <Select value={selectedEmail} onValueChange={(v) => v && router.push(`/daily-report?email=${encodeURIComponent(v)}`)} items={items}>
      <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-64">
        <UserCog className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Chọn Sale…" />
      </SelectTrigger>
      <SelectContent>
        {sales.map((s) => (
          <SelectItem key={s.email} value={s.email}>
            {s.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
